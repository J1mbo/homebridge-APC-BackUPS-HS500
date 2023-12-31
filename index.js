// Plugin for the APC UPS monitoring
// Copyright (c) James Pearce, 2020,2023
// Last updated December 2023
//
// Version 3:
// - Adds support for the UPS 'reboot' function
// - Fixes embedded accessory display names in IOS 16 and above
//
// Version 2:
// Adds support for:
// - automatic configuration of UPS management interface for static IP or DHCP
// - auto-discovery of UPS network address
// - control of the three UPS outputs (by exposing them as outlet devices)
// - allows the blocking of UPS outlet control to prevent accidental power-off
// - reporting of UPS load and run-time (through lightsensor devices)
//
// Version 1:
// Provides:
// - monitoring of the UPS mains inlet via Contact Sensor
// - monitoring of the battery charge level and charging status through Battery Service.
//
// globals and imports
var exec = require('child_process').exec;

// HomeKit API registration
module.exports = (api) => {
  api.registerAccessory('APCBackUpsHS500', APCBackUpsHS500);
}


  // support functions
  // THE FOLLOW IS APC CODE, USE IT WITH HOPE, THAT IT WILL WORK
  function toHex(dec) {
    var hexChars = "0123456789ABCDEF";
    var i = dec;
    if (dec > 16) {
      while (i >= 16) {
        i-= 16;
      }
    }
    var j = ((dec - i) / 16);
    var result = hexChars.charAt(j);
    result += hexChars.charAt(i);
    return result;
  }

  function pwcode(field) {
    var len = field.length;
    parsebuf = new Array(len);
    for (var i = 0; i < len; i++) {
      parsebuf[i] = field.charCodeAt(i);
      parsebuf[i] = toHex(parseInt(parsebuf[i], 10));
    }
    var result = parsebuf.join('-');
    return result;
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
      this.autoConfigure = config.autoConfigure || 0;
      this.upsIpAddress = config.upsIpAddress;
      this.upsCommand = __dirname + '/' + config.statusCommand;
      this.configureCommand = __dirname + '/' + config.configureCommand;
      this.serialNumber = config.serialNumber;
      this.pollTimer = config.pollTimer || 30; //default poll interval = 30 seconds
      this.lowBattery = config.lowBattery || 20; // default warn at 20% remaining
      this.outlet1Name = config.outlet1Name || 'Outlet 1';
      this.outlet2Name = config.outlet2Name || 'Outlet 2';
      this.outlet3Name = config.outlet3Name || 'Outlet 3';
      this.outlet1RebootName = 'Reboot ' + config.outlet1Name;
      this.outlet2RebootName = 'Reboot ' + config.outlet2Name;
      this.outlet3RebootName = 'Reboot ' + config.outlet3Name;
      this.apcUsername = config.apcUsername || 'apc';
      this.apcPassword = config.apcPassword || 'apc';
      this.outlet1Locked = config.outlet1Locked || 0;
      this.outlet2Locked = config.outlet2Locked || 0;
      this.outlet3Locked = config.outlet3Locked || 0;
      this.outlet1RebootEnabled = config.outlet1RebootEnabled;
      this.outlet2RebootEnabled = config.outlet2RebootEnabled;
      this.outlet3RebootEnabled = config.outlet3RebootEnabled;

      this.state = {
        contactSensorState: 0,
        batteryLevel: 0,
        chargingState: 0,
        statusLowBattery: 0,
        upsLoad: 0.01,
        runtime: 0.01,
        outlet1On: 1,
        outlet1InUse: 1,
        outlet2On: 1,
        outlet2InUse: 1,
        outlet3On: 1,
        outlet3InUse: 1,
        updating: 0,
      };

      // Create the services
      this.contactSensor = new this.Service.ContactSensor(this.name); // reports open/close - open when on battery
      this.batteryService = new this.Service.BatteryService(); // reports charging status, % charge, and low battery condition
      this.upsLoadService = new this.Service.LightSensor("Load (Watts)","Load"); // just a way to report UPS load
      this.upsRuntimeService = new this.Service.LightSensor("Runtime (Minutes)","Runtime"); // just a way to report UPS runtime
      this.outlet1Service = new this.Service.Outlet(this.outlet1Name,"Outlet1"); // enables on/off control of output 1
      this.outlet2Service = new this.Service.Outlet(this.outlet2Name,"Outlet2"); // enables on/off control of output 2
      this.outlet3Service = new this.Service.Outlet(this.outlet3Name,"Outlet3"); // enables on/off control of output 3
      this.outlet1RebootService = new this.Service.Switch("Reboot Outlet1","Outlet1"); // enables reboot of output 1
      this.outlet2RebootService = new this.Service.Switch("Reboot Outlet2","Outlet2"); // enables reboot of output 2
      this.outlet3RebootService = new this.Service.Switch("Reboot Outlet3","Outlet3"); // enables reboot of output 3

      // IOS 16 and above over-writes the descriptive names set against the accesories
      // The following restores them to display as previously (e.g., on IOS 15)
      this.contactSensor.addOptionalCharacteristic(this.Characteristic.ConfiguredName);
      this.contactSensor.setCharacteristic(this.Characteristic.ConfiguredName, 'Mains Status');

      this.upsLoadService.addOptionalCharacteristic(this.Characteristic.ConfiguredName);
      this.upsLoadService.setCharacteristic(this.Characteristic.ConfiguredName, 'Load (Watts)');

      this.upsRuntimeService.addOptionalCharacteristic(this.Characteristic.ConfiguredName);
      this.upsRuntimeService.setCharacteristic(this.Characteristic.ConfiguredName, 'Runtime (Minutes)');

      this.outlet1Service.addOptionalCharacteristic(this.Characteristic.ConfiguredName);
      this.outlet1Service.setCharacteristic(this.Characteristic.ConfiguredName, this.outlet1Name);

      this.outlet2Service.addOptionalCharacteristic(this.Characteristic.ConfiguredName);
      this.outlet2Service.setCharacteristic(this.Characteristic.ConfiguredName, this.outlet2Name);

      this.outlet3Service.addOptionalCharacteristic(this.Characteristic.ConfiguredName);
      this.outlet3Service.setCharacteristic(this.Characteristic.ConfiguredName, this.outlet3Name);

      this.outlet1RebootService.addOptionalCharacteristic(this.Characteristic.ConfiguredName);
      this.outlet1RebootService.setCharacteristic(this.Characteristic.ConfiguredName, this.outlet1RebootName);

      this.outlet2RebootService.addOptionalCharacteristic(this.Characteristic.ConfiguredName);
      this.outlet2RebootService.setCharacteristic(this.Characteristic.ConfiguredName, this.outlet2RebootName);

      this.outlet3RebootService.addOptionalCharacteristic(this.Characteristic.ConfiguredName);
      this.outlet3RebootService.setCharacteristic(this.Characteristic.ConfiguredName, this.outlet3RebootName);

      // create an information service...
      this.informationService = new this.Service.AccessoryInformation()
        .setCharacteristic(this.Characteristic.Manufacturer, "APC")
        .setCharacteristic(this.Characteristic.Model, this.model)
        .setCharacteristic(this.Characteristic.SerialNumber, this.serialNumber);

      this.contactSensor
        .setCharacteristic(this.Characteristic.Name, "AC Input Connection")
        .getCharacteristic(this.Characteristic.ContactSensorState)
        .on('get', this.getContactState.bind(this));

      this.batteryService
        .setCharacteristic(this.Characteristic.Name, "RBC2 / Vision CP1270 / Yuasa NPW45-12")
        .getCharacteristic(this.Characteristic.BatteryLevel)
        .on('get', this.getBatteryLevel.bind(this));
      this.batteryService
        .getCharacteristic(this.Characteristic.ChargingState)
        .on('get', this.getChargingState.bind(this));
      this.batteryService
        .getCharacteristic(this.Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));

      this.upsLoadService
        .getCharacteristic(this.Characteristic.CurrentAmbientLightLevel)
        .on('get', this.getUpsLoad.bind(this));

      this.upsRuntimeService
        .getCharacteristic(this.Characteristic.CurrentAmbientLightLevel)
        .on('get', this.getUpsRuntime.bind(this));

      this.outlet1Service
        .getCharacteristic(this.Characteristic.On)
        .on('get', this.getOutlet1State.bind(this))
        .on('set', this.setOutlet1State.bind(this));
      this.outlet1Service
        .getCharacteristic(this.Characteristic.OutletInUse)
        .on('get', this.getOutlet1InUse.bind(this));

      this.outlet2Service
        .getCharacteristic(this.Characteristic.On)
        .on('get', this.getOutlet2State.bind(this))
        .on('set', this.setOutlet2State.bind(this));
      this.outlet2Service
        .getCharacteristic(this.Characteristic.OutletInUse)
        .on('get', this.getOutlet2InUse.bind(this));

      this.outlet3Service
        .getCharacteristic(this.Characteristic.On)
        .on('get', this.getOutlet3State.bind(this))
        .on('set', this.setOutlet3State.bind(this));
      this.outlet3Service
        .getCharacteristic(this.Characteristic.OutletInUse)
        .on('get', this.getOutlet3InUse.bind(this));

      // Outlet reboot switches - these default to 'off' and trigger momentarily, returning to 'off'
      this.outlet1RebootService
        .getCharacteristic(this.Characteristic.On)
        .on('get', this.getOutlet1RebootState.bind(this))
        .on('set', this.setOutlet1RebootState.bind(this));
      this.outlet2RebootService
        .getCharacteristic(this.Characteristic.On)
        .on('get', this.getOutlet2RebootState.bind(this))
        .on('set', this.setOutlet2RebootState.bind(this));
      this.outlet3RebootService
        .getCharacteristic(this.Characteristic.On)
        .on('get', this.getOutlet3RebootState.bind(this))
        .on('set', this.setOutlet3RebootState.bind(this));
  } // constructor

  // mandatory getServices function tells HomeBridge how to use this object
  getServices() {
    var accessory = this;
    var Characteristic = this.Characteristic;
    var command;
    var upsreponse;
    accessory.log.debug(accessory.name + ': Invoked getServices');

    // check if UPS requires discovery/configuration
    if (accessory.autoConfigure | accessory.upsIpAddress == "0.0.0.0") {
      // auto-configure the UPS, or discovery it
      if (accessory.autoConfigure) {
        // auto-configure
        command = accessory.configureCommand + " -s=" + accessory.upsIpAddress;
      } else {
        // Discover only
        command = accessory.configureCommand + " -f";
      }
      exec(command, function (err, stdout, stderr) {
        if (err) {
          accessory.log('Error: ' + err + ' ' + stderr);
          if (callback) callback(err || new Error('Could not find a APC 500HS UPS (' + accessory.name +')'));
        } else {
          // script executed - check json object returned
          var upsresponse = JSON.parse( stdout.toString('utf-8').trim() );
          accessory.log('Discovered UPS at ' + upsresponse.IPAddress + ' with serial number: ' + upsresponse.SerialNumber);
          accessory.upsIpAddress = upsresponse.IPAddress;
          accessory.serialNumber = upsresponse.SerialNumber;
          accessory.pollUpsState(); // initialise plugin with discovered IP address
        }
      }); // exec
    } else {
      // Initialise the plugin ahead of any function call with static configured IP address
      //this.upsLoadService.getCharacteristic(Characteristic.CurrentAmbientLightLevel).props.unit = "Watts";
      //this.upsRuntimeService.getCharacteristic(Characteristic.CurrentAmbientLightLevel).props.unit = "Minutes";
      accessory.pollUpsState();
    }
    // and retrun the services to HomeBridge
    return [
      accessory.informationService,
      accessory.contactSensor,
      accessory.batteryService,
      accessory.upsLoadService,
      accessory.upsRuntimeService,
      accessory.outlet1Service,
      accessory.outlet2Service,
      accessory.outlet3Service,
      accessory.outlet1RebootService,
      accessory.outlet2RebootService,
      accessory.outlet3RebootService,
    ];
  } // getServices()/

  getBatteryLevel(callback) {
    var accessory = this;
    accessory.log.debug('Battery Level: ', accessory.state.batteryLevel);
    callback(null, accessory.state.batteryLevel);
  }

  getChargingState(callback) {
    var accessory = this;
    accessory.log.debug('Charging State: ', accessory.state.chargingState);
    callback(null, accessory.state.chargingState);
  }

  getStatusLowBattery(callback) {
    var accessory = this;
    accessory.log.debug('Status Low Battery: ', accessory.state.statusLowBattery);
    callback(null, accessory.state.statusLowBattery);
  }

  getUpsLoad(callback) {
    var accessory = this;
    accessory.log.debug('UPS Load: ', accessory.state.upsLoad);
    callback(null, accessory.state.upsLoad);
  }

  getUpsRuntime(callback) {
    var accessory = this;
    accessory.log.debug('UPS Runtime: ', accessory.state.runtime);
    callback(null, accessory.state.runtime);
  }

  getOutlet1State(callback) {
    var accessory = this;
    accessory.log.debug('Outlet 1 (', accessory.outlet1Name, ') State: ', accessory.state.outlet1On);
    callback(null, accessory.state.outlet1On);
  }

  setOutlet1State(on, callback) {
    var accessory = this;
    var Characteristic = this.Characteristic;
    var command;
    accessory.log.debug('setOutlet1State: ', on);
    accessory.pollState(); // (re)start polling timer
    accessory.state.updating = accessory.state.updating | 1; // flag that we are updating

    if (on) {
      accessory.log('Outlet 1 Power on requested');
    } else {
      accessory.log('Outlet 1 Power off requested');
    }
    if (accessory.outlet1Locked) {
      accessory.log('Error: Outlet 1 is locked. Command not sent to device.');
      if (callback) callback(new Error('Error: Outlet 1 is locked (' + accessory.name + ')'), accessory.state.outlet1On);
    } else {
      if (on) {
        command = accessory.upsCommand + " ip=" + accessory.upsIpAddress + " output1=on";
        accessory.state.outlet1On = 1;
        accessory.state.outlet1InUse = 1;
      } else {
        command = accessory.upsCommand + " ip=" + accessory.upsIpAddress + " output1=off";
        accessory.state.outlet1On = 0;
        accessory.state.outlet1InUse = 0;
      }
      command = command + " user=" + accessory.apcUsername + " pass=" + pwcode(accessory.apcPassword);
      exec(command, function (err, stdout, stderr) {
        if (err) {
          accessory.log('Error: ' + err + ' ' + stderr);
          if (callback) callback(err || new Error('Error calling ' + command + ' in ' + accessory.name));
        } else {
          // update the object characteristics with the change
          accessory.log.debug('setOutlet1State command completed without error.');
          accessory.outlet1Service.updateCharacteristic(Characteristic.OutletInUse, accessory.state.outlet1InUse);
          if (callback) {
            callback(null, accessory.state.outlet1On);
          }
        }
      }); // exec function
    } // if accessory.outlet1Locked
  } // setOutlet1State

  getOutlet1InUse(callback) {
    var accessory = this;
    accessory.log.debug('Outlet 1 (', accessory.outlet1Name, ') In Use: ' + accessory.state.outlet1InUse);
    callback(null, accessory.state.outlet1InUse);
  }

  getOutlet2State(callback) {
    var accessory = this;
    accessory.log.debug('Outlet 2 (', accessory.outlet2Name, ') State: ', accessory.state.outlet2On);
    callback(null, accessory.state.outlet2On);
  }

  setOutlet2State(on, callback) {
    var accessory = this;
    var Characteristic = this.Characteristic;
    var command;
    accessory.log.debug('setOutlet2State: ', on);
    accessory.pollState(); // (re)start polling timer
    accessory.state.updating = accessory.state.updating | 2; // flag that we are updating

    if (on) {
      accessory.log('Outlet 2 Power on requested');
    } else {
      accessory.log('Outlet 2 Power off requested');
    }
    if (accessory.outlet2Locked) {
      accessory.log('Error: Outlet 2 is locked. Command not sent to device.');
      if (callback) callback(new Error('Error: Outlet 2 is locked (' + accessory.name + ')'), accessory.state.outlet2On);
    } else {
      if (on) {
        command = accessory.upsCommand + " ip=" + accessory.upsIpAddress + " output2=on";
        accessory.state.outlet2On = 1;
        accessory.state.outlet2InUse = 1;
      } else {
        command = accessory.upsCommand + " ip=" + accessory.upsIpAddress + " output2=off";
        accessory.state.outlet2On = 0;
        accessory.state.outlet2InUse = 0;
      }
      command = command + " user=" + accessory.apcUsername + " pass=" + pwcode(accessory.apcPassword);
      exec(command, function (err, stdout, stderr) {
        if (err) {
          accessory.log('Error: ' + err + ' ' + stderr);
          if (callback) callback(err || new Error('Error calling ' + command + ' in ' + accessory.name));
        } else {
          // update the object characteristics with the change
          accessory.log.debug('setOutlet2State command completed without error.');
          accessory.outlet2Service.updateCharacteristic(Characteristic.OutletInUse, accessory.state.outlet2InUse);
          if (callback) {
            callback(null, accessory.state.outlet2On);
          }
        }
      }); // exec function
    } // if accessory.outlet2Locked
  } // setOutlet2State

  getOutlet2InUse(callback) {
    var accessory = this;
    accessory.log.debug('Outlet 2 (', accessory.outlet2Name, ') In Use: ' + accessory.state.outlet2InUse);
    callback(null, accessory.state.outlet2InUse);
  }

  getOutlet3State(callback) {
    var accessory = this;
    accessory.log.debug('Outlet 3 (', accessory.outlet3Name, ') State: ', accessory.state.outlet3On);
    callback(null, accessory.state.outlet3On);
  }

  setOutlet3State(on, callback) {
    var accessory = this;
    var Characteristic = this.Characteristic;
    var command;
    accessory.log.debug('setOutlet3State: ', on);
    accessory.pollState(); // (re)start polling timer
    accessory.state.updating = accessory.state.updating | 4; // flag that we are updating

    if (on) {
      accessory.log('Outlet 3 Power on requested');
    } else {
      accessory.log('Outlet 3 Power off requested');
    }
    if (accessory.outlet3Locked) {
      accessory.log('Error: Outlet 3 is locked. Command not sent to device.');
      if (callback) callback(new Error('Error: Outlet 3 is locked (' + accessory.name + ')'), accessory.state.outlet3On);
    } else {
      if (on) {
        command = accessory.upsCommand + " ip=" + accessory.upsIpAddress + " output3=on";
        accessory.state.outlet3On = 1;
        accessory.state.outlet3InUse = 1;
      } else {
        command = accessory.upsCommand + " ip=" + accessory.upsIpAddress + " output3=off";
        accessory.state.outlet3On = 0;
        accessory.state.outlet3InUse = 0;
      }
      command = command + " user=" + accessory.apcUsername + " pass=" + pwcode(accessory.apcPassword);
      exec(command, function (err, stdout, stderr) {
        if (err) {
          accessory.log('Error: ' + err + ' ' + stderr);
          if (callback) callback(err || new Error('Error calling ' + command + ' in ' + accessory.name));
        } else {
          // update the object characteristics with the change
          accessory.log.debug('setOutlet3State command completed without error.');
          accessory.outlet3Service.updateCharacteristic(Characteristic.OutletInUse, accessory.state.outlet3InUse);
          if (callback) {
            callback(null, accessory.state.outlet3On);
          }
        }
      }); // exec function
    } // if accessory.outlet3Locked
  } // setOutlet3State

  getOutlet3InUse(callback) {
    var accessory = this;
    accessory.log.debug('Outlet 3 (', accessory.outlet3Name, ') In Use: ' + accessory.state.outlet3InUse);
    callback(null, accessory.state.outlet3InUse);
  }


  // reboot handlers

  getOutlet1RebootState(callback) {
    var accessory = this;
    accessory.log.debug('Outlet 1 (', accessory.Outlet1Name, ') Reboot Switch State is off.'); // always returns 0
    callback(null, 0); // always returns 0 (off)
  }

  setOutlet1RebootState(on, callback) {
    var accessory = this;
    var Characteristic = this.Characteristic;
    var command;
    accessory.log.debug('setOutlet1RebootState: ', on);
    accessory.pollState(); // (re)start polling timer
    if ((accessory.state.updating & 8) == 8) {
      // an instance of this function is already running; return switch active
      accessory.log.debug('setOutlet1RebootState is already running.');
      callback(null, 1); // switch is 'ON' - function is running already
    } else {
      accessory.state.updating |= 8; // flag that we are updating
      if (on) {
        accessory.log('Outlet 1 Reboot requested');
      } else {
        accessory.log('Outlet 1 Reboot cancellation requested');
      }
      if (!accessory.outlet1RebootEnabled) {
        accessory.log('Error: Outlet 1 is locked. Command not sent to device.');
        if (callback) callback(new Error('Error: Outlet 1 is locked (' + accessory.name + ')'), 0); // always report 0 for the reboot switch
        accessory.state.updating ^= 8;
      } else {
        if (on) {
          command = accessory.upsCommand + " ip=" + accessory.upsIpAddress + " output1=reboot";
        } else {
          accessory.log('Outlet 1 Reboot cancellation requested does not carry any action since this is done within the UPS itself.');
        }
        command = command + " user=" + accessory.apcUsername + " pass=" + pwcode(accessory.apcPassword);
        exec(command, function (err, stdout, stderr) {
          if (err) {
            accessory.log('Error: ' + err + ' ' + stderr);
            accessory.state.updating ^= 32;
            accessory.outlet1RebootService.updateCharacteristic(Characteristic.On, 0); // always returns 0 = OFF
          } else {
            // update the object characteristics with the change
            accessory.state.updating ^= 32;
            accessory.log.debug('setOutlet1Reboot command completed without error.');
            accessory.outlet1RebootService.updateCharacteristic(Characteristic.On, 0); // always returns 0 = OFF
          }
        }); // exec function
        if (callback) { // call back immediately, whilst script runs
          callback(null, 0);
        }
      } // if accessory.Outlet1Locked
    } // if/else already running
  } // setOutlet1RebootState


  getOutlet2RebootState(callback) {
    var accessory = this;
    accessory.log.debug('Outlet 2 (', accessory.Outlet2Name, ') Reboot Switch State is off.'); // always returns 0
    callback(null, 0); // always returns 0 (off)
  }

  setOutlet2RebootState(on, callback) {
    var accessory = this;
    var Characteristic = this.Characteristic;
    var command;
    accessory.log.debug('setOutlet2RebootState: ', on);
    accessory.pollState(); // (re)start polling timer
    if ((accessory.state.updating & 16) == 16) {
      // an instance of this function is already running; return switch active
      accessory.log.debug('setOutlet2RebootState is already running.');
      callback(null, 1); // switch is 'ON' - function is running already
    } else {
      accessory.state.updating |= 16; // flag that we are updating
      if (on) {
        accessory.log('Outlet 2 Reboot requested');
      } else {
        accessory.log('Outlet 2 Reboot cancellation requested');
      }
      accessory.log('outlet1RebootEnabled: ' + accessory.outlet1RebootEnabled);
      accessory.log('outlet2RebootEnabled: ' + accessory.outlet2RebootEnabled);
      accessory.log('outlet3RebootEnabled: ' + accessory.outlet3RebootEnabled);
      if (!(accessory.outlet2RebootEnabled)) {
        accessory.log('Error: Outlet 2 is locked. Command not sent to device.');
        if (callback) callback(new Error('Error: Outlet 2 is locked (' + accessory.name + ')'), 0); // always report 0 for the reboot switch
        accessory.state.updating ^= 16;
      } else {
        if (on) {
          command = accessory.upsCommand + " ip=" + accessory.upsIpAddress + " output2=reboot";
        } else {
          accessory.log('Outlet 2 Reboot cancellation requested does not carry any action since this is done within the UPS itself.');
        }
        command = command + " user=" + accessory.apcUsername + " pass=" + pwcode(accessory.apcPassword);
        exec(command, function (err, stdout, stderr) {
          if (err) {
            accessory.log('Error: ' + err + ' ' + stderr);
            accessory.state.updating ^= 32;
            accessory.outlet2RebootService.updateCharacteristic(Characteristic.On, 0); // always returns 0 = OFF
          } else {
            // update the object characteristics with the change
            accessory.state.updating ^= 32;
            accessory.log.debug('setOutlet2Reboot command completed without error.');
            accessory.outlet2RebootService.updateCharacteristic(Characteristic.On, 0); // always returns 0 = OFF
          }
        }); // exec function
        if (callback) { // call back immediately, whilst script runs
          callback(null, 0);
        }
      } // if accessory.Outlet2Locked
    } // if/else already running
  } // setOutlet2RebootState


  getOutlet3RebootState(callback) {
    var accessory = this;
    accessory.log.debug('Outlet 3 (', accessory.outlet3Name, ') Reboot Switch State is off.'); // always returns 0
    callback(null, 0); // always returns 0 (off)
  }

  setOutlet3RebootState(on, callback) {
    var accessory = this;
    var Characteristic = this.Characteristic;
    var command;
    accessory.log.debug('setOutlet3RebootState: ', on);
    accessory.pollState(); // (re)start polling timer
    if ((accessory.state.updating & 32) == 32) {
      // an instance of this function is already running; return switch active
      accessory.log.debug('setOutlet3RebootState is already running.');
      callback(null, 1); // switch is 'ON' - function is running already
    } else {
      accessory.state.updating |= 32; // flag that we are updating
      if (on) {
        accessory.log('Outlet 3 Reboot requested');
      } else {
        accessory.log('Outlet 3 Reboot cancellation requested');
      }
      if (!accessory.outlet3RebootEnabled) {
        accessory.log('Error: Outlet 3 is locked. Command not sent to device.');
        if (callback) callback(new Error('Error: Outlet 3 is locked (' + accessory.name + ')'), 0); // always report 0 for the reboot switch
        accessory.state.updating ^= 32;
      } else {
        if (on) {
          command = accessory.upsCommand + " ip=" + accessory.upsIpAddress + " output3=reboot";
        } else {
          accessory.log('Outlet 3 Reboot cancellation requested does not carry any action since this is done within the UPS itself.');
        }
        command = command + " user=" + accessory.apcUsername + " pass=" + pwcode(accessory.apcPassword);
        exec(command, function (err, stdout, stderr) {
          if (err) {
            accessory.log('Error: ' + err + ' ' + stderr);
            accessory.state.updating ^= 32;
            accessory.outlet3RebootService.updateCharacteristic(Characteristic.On, 0); // always returns 0 = OFF
          } else {
            // update the object characteristics with the change
            accessory.state.updating ^= 32;
            accessory.log.debug('setOutlet3Reboot command completed without error.');
            accessory.outlet3RebootService.updateCharacteristic(Characteristic.On, 0); // always returns 0 = OFF
          }
        }); // exec function
        if (callback) { // call back immediately, whilst script runs
          callback(null, 0);
        }
      } // if accessory.outlet3Locked
    } // if/else already running
  } // setOutlet3RebootState



  // mains input active

  getContactState(callback) {
    var accessory = this;
    accessory.log.debug('Contact State (=On Mains flag): ', accessory.state.contactSensorState);
    callback(null, accessory.state.contactSensorState);
  }

  pollUpsState(callback) {
    // Background status polling function.
    var accessory = this;
    var Characteristic = this.Characteristic;

    var command = accessory.upsCommand + " ip=" + accessory.upsIpAddress + " status";
    accessory.log.debug("pollUpsState: Running " + command);

    exec(command, function (err, stdout, stderr) {
      if (err) {
        accessory.log('Error: ' + err + ' ' + stderr);
        if (callback) callback(err || new Error('Error getting state of ' + accessory.name));
      } else {
        // script executed - check json object returned
        var upsresponse = JSON.parse( stdout.toString('utf-8').trim() );
        if (!upsresponse) {
          // text wasn't json
          var array = stdout.toString().split("\n");
          accessory.log('Error in json received (got: ' + !array[0] + ')');
          if (callback) callback(err || new Error('Error getting state of ' + accessory.name));
        } else {
          // valid json returned, hopefully with all the values we need
          // check the UPS status is one of 'On Line' or 'On Battery'
          accessory.log.debug( 'UPS Status received: ' + stdout.toString() );
          if ((upsresponse.upsstatus != 'On Line') && (upsresponse.upsstatus != 'On Battery')) {
            // what we received doesn't look to contain anything useful
            accessory.log('Error in json received (upsstatus received: ' + upsresponse.upsstatus + ')');
            if (callback) callback(err || new Error('Error getting state of ' + accessory.name));
          } else {
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

            accessory.log.debug( 'UPS Load: ' + upsresponse.load + 'W (' + (upsresponse.load * 100 / 300) + '%)' );
            accessory.state.upsLoad = upsresponse.load;

            accessory.log.debug( 'UPS Runtime received: ' + upsresponse.runtime );
            accessory.state.runtime = upsresponse.runtime;

            accessory.log.debug( 'Output 1 (' + accessory.outlet1Name + '): ' + upsresponse.output1 );
            if (upsresponse.output1 == 'on') {
              accessory.state.outlet1On = 1;
              accessory.state.outlet1InUse = 1;
            } else if (upsresponse.output1 == 'off') {
              accessory.state.outlet1On = 0;
              accessory.state.outlet1InUse = 0;
            } // if we didn't receive on or off, don't chacge to current state as an outlet state change could be triggered!

            accessory.log.debug( 'Output 2 (' + accessory.outlet2Name + '): ' + upsresponse.output2 );
            if (upsresponse.output2 == 'on') {
              accessory.state.outlet2On = 1;
              accessory.state.outlet2InUse = 1;
            } else if (upsresponse.output2 == 'off') {
              accessory.state.outlet2On = 0;
              accessory.state.outlet2InUse = 0;
            } // if we didn't receive on or off, don't chacge to current state as an outlet state change could be triggered!

            accessory.log.debug( 'Output 3 (' + accessory.outlet3Name + '): ' + upsresponse.output3 );
            if (upsresponse.output3 == 'on') {
              accessory.state.outlet3On = 1;
              accessory.state.outlet3InUse = 1;
            } else if (upsresponse.output3 == 'off') {
              accessory.state.outlet3On = 0;
              accessory.state.outlet3InUse = 0;
            } // if we didn't receive on or off, don't chacge to current state as an outlet state change could be triggered!

            accessory.log.debug("pollUpsState: Updating accessory state...");
            accessory.contactSensor.updateCharacteristic(Characteristic.ContactSensorState, accessory.state.contactSensorState);
            accessory.batteryService.updateCharacteristic(Characteristic.BatteryLevel, accessory.state.batteryLevel);
            accessory.batteryService.updateCharacteristic(Characteristic.ChargingState, accessory.state.chargingState);
            accessory.batteryService.updateCharacteristic(Characteristic.StatusLowBattery, accessory.state.statusLowBattery);
            accessory.upsLoadService.updateCharacteristic(Characteristic.CurrentAmbientLightLevel, accessory.state.upsLoad);
            accessory.upsRuntimeService.updateCharacteristic(Characteristic.CurrentAmbientLightLevel, accessory.state.runtime);
            if (accessory.state.updating) {
              accessory.log.debug("pollUpsState: Outlet state changed from HomeKit, outlet status will not be updated until next run.");
              accessory.state.updating = 0; // clear lock to ensure we process any changes next time
            } else {
              // update HomeBridge with all status of all elements
              accessory.log.debug("pollUpsState: Updating outlet states...");
              accessory.outlet1Service.updateCharacteristic(Characteristic.On, accessory.state.outlet1On);
              accessory.outlet1Service.updateCharacteristic(Characteristic.OutletInUse, accessory.state.outlet1InUse);
              accessory.outlet2Service.updateCharacteristic(Characteristic.On, accessory.state.outlet2On);
              accessory.outlet2Service.updateCharacteristic(Characteristic.OutletInUse, accessory.state.outlet2InUse);
              accessory.outlet3Service.updateCharacteristic(Characteristic.On, accessory.state.outlet3On);
              accessory.outlet3Service.updateCharacteristic(Characteristic.OutletInUse, accessory.state.outlet3InUse);
              accessory.outlet1RebootService.updateCharacteristic(Characteristic.On, 0); // always returns 0 = OFF
              accessory.outlet2RebootService.updateCharacteristic(Characteristic.On, 0); // always returns 0 = OFF
              accessory.outlet3RebootService.updateCharacteristic(Characteristic.On, 0); // always returns 0 = OFF
            } // if (accessory.state.updating)/else
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
        accessory.pollUpsState(function(err, CurrentDeviceState) {
          if (err) {
            accessory.log(err);
            return;
          }
        })
      }, accessory.pollTimer * 1000
    );
  } // pollState

} // class APCaccess
