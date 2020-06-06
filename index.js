// Plugin for the APC UPS monitoring
// Copyright (c) James Pearce, 2020
// Last updated May 2020 Revision 1

// globals and imports
var exec = require('child_process').exec;

// HomeKit API registration
module.exports = (api) => {
  api.registerAccessory('APCBackUpsHS500', APCBackUpsHS500);
}


class APCBackUpsHS500 {

  constructor(log, config, api) {
      this.log = log;
      this.config = config;
      this.api = api;

      this.Service = this.api.hap.Service;
      this.Characteristic = this.api.hap.Characteristic;

      this.name = config.name || 'APC UPS';
      this.model = config.model || 'APC UPS Type';
      this.upsIpAddress = config.upsIpAddress;
      this.statusCommand = __dirname + '/' + config.statusCommand;
      this.serialNumber = config.serialNumber;
      this.pollTimer = config.pollTimer || 30; //default poll interval = 30 seconds
      this.lowBattery = config.lowBattery || 20; // default warn at 20% remaining

      this.state = {
        contactSensorState: 0,
        batteryLevel: 0,
        chargingState: 0,
        statusLowBattery: 0,
      };

      // The following can't be defined on boot, so define them optionally in config
      this.contactSensor = new this.Service.ContactSensor(this.name);

      // create an information service...
      this.informationService = new this.Service.AccessoryInformation()
        .setCharacteristic(this.Characteristic.Manufacturer, "APC")
        .setCharacteristic(this.Characteristic.Model, this.model)
        .setCharacteristic(this.Characteristic.SerialNumber, this.serialNumber);

      this.batteryService = new this.Service.BatteryService();

      this.contactSensor
        .getCharacteristic(this.Characteristic.ContactSensorState)
        .on('get', this.getContactState.bind(this));
      this.batteryService
        .getCharacteristic(this.Characteristic.BatteryLevel)
        .on('get', this.getBatteryLevel.bind(this));
      this.batteryService
        .getCharacteristic(this.Characteristic.ChargingState)
        .on('get', this.getChargingState.bind(this));
      this.batteryService
        .getCharacteristic(this.Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
  } // constructor

  // mandatory getServices function tells HomeBridge how to use this object
  getServices() {
    return [
      this.informationService,
      this.contactSensor,
      this.batteryService,
    ];
  } // getServices()/

  getBatteryLevel(callback) {
    var accessory = this;
    accessory.log.debug('Battery Level: ', accessory.batteryLevel);
    callback(null, accessory.batteryLevel);
  }

  getChargingState(callback) {
    var accessory = this;
    accessory.log.debug('Charging State: ', accessory.chargingState);
    callback(null, accessory.chargingState);
  }

  getStatusLowBattery(callback) {
    var accessory = this;
    accessory.log.debug('Status Low Battery: ', accessory.statusLowBattery);
    callback(null, accessory.statusLowBattery);
  }

  getContactState(callback) {
    var accessory = this;
    var Characteristic = this.Characteristic;
    accessory.log.debug('Contact State (=On Mains flag): ', accessory.contactState);

    var command = accessory.statusCommand + " " + accessory.upsIpAddress;
    accessory.log.debug('Running ' + command);

    exec(command, function (err, stdout, stderr) {
      if (err) {
        accessory.log('Error: ' + err + ' ' + stderr);
        if (callback) callback(err || new Error('Error getting state of ' + accessory.name));
      } else {
        // got something back
        var upsresponse = JSON.parse( stdout.toString('utf-8').trim() );
        if (!upsresponse) {
          // text wasn't json
          var array = stdout.toString().split("\n");
          accessory.log('Error in json received (got: ' + !array[0] + ')');
          if (callback) callback(err || new Error('Error getting state of ' + accessory.name));
        } else {
          // valid json returned, hopefully with all the values we need
          accessory.log.debug( 'UPS Status received: ' + upsresponse.upsstatus );
          if (upsresponse.upsstatus != 'On Line') {
            accessory.state.contactSensorState = 1 // contact is ON, i.e. ALERT STATE (on battery)
          } else {
            accessory.state.contactSensorState = 0 // contact is OFF, i.e. normal conditions (on mains)
          }

          accessory.log.debug( 'UPS Battery Level received: ' + upsresponse.batterylevel );
          accessory.state.batteryLevel = upsresponse.batterylevel;
          if (accessory.state.batteryLevel < accessory.lowBattery) {
            accessory.state.statusLowBattery = 1 // BATTERY_LEVEL_LOW
          } else {
            accessory.state.statusLowBattery = 0 // BATTERY_LEVEL_NORMAL
          }

          accessory.state.chargingState = 0; // Assume NOT_CHARGING otherwise
          accessory.log.debug( 'UPS Battery Status received: ' + upsresponse.batterystatus );
          if (upsresponse.batterystatus == 'Charging') {
            accessory.state.chargingState = 1; // CHARGING
          }
          if (upsresponse.batterystatus == 'Charged') {
            accessory.state.chargingState = 1; // CHARGING
          }

          accessory.contactSensor.updateCharacteristic(Characteristic.ContactSensorState, accessory.state.contactSensorState);
          accessory.batteryService.updateCharacteristic(Characteristic.BatteryLevel, accessory.state.batteryLevel);
          accessory.batteryService.updateCharacteristic(Characteristic.ChargingState, accessory.state.chargingState);
          accessory.batteryService.updateCharacteristic(Characteristic.StatusLowBattery, accessory.state.statusLowBattery);

          if (callback) {
            callback(null, accessory.state.contactSensorState);
          }
        }
      } // if (err) / else
    }); // exec
    accessory.pollState(); // (re)start polling timer
  } // getState

  /**
    * Polling function
  */
  pollState = function() {
    var accessory = this;
    var Characteristic = this.Characteristic;

    // Clear any existing timer
    if (accessory.stateTimer) {
      clearTimeout(accessory.stateTimer);
      accessory.stateTimer = null;
    }

    // define the new poll function
    accessory.stateTimer = setTimeout(
      function() {
        accessory.getContactState(function(err, CurrentDeviceState) {
          if (err) {
            accessory.log(err);
            return;
          }
        })
      }, accessory.pollTimer * 1000
    );
  } // pollState

} // class APCaccess
