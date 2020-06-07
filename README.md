# homebridge-APC-Back-UPS-HS500

A HomeBridge interface for APC's 'Structured Cabling' Back-UPS HS500 UPS device. Also includes a UPS configuration script.

<img src="https://user-images.githubusercontent.com/784541/83963920-34f69e00-a8a1-11ea-9d1b-cb2c673c23e2.png" width="250"/>

The plugin creates a Contact Sensor, which is capable of reporting state only, which is normally in the CLOSED state. If the UPS switches to battery power, the Contact Sensor reports OPEN state. Hence, alerts can be generated on Apple HomeKit device (in particular the watch). The battery charge percentage is also reported within the sensor (viewable on iPhone) along with a Low Battery alert.

Credits: This plugin was developed using cr3ative/homebridge-apcaccess as a starting point.

<img src="https://user-images.githubusercontent.com/1850718/75247783-a0bd6b00-57ca-11ea-9391-0db0afdaf2cf.PNG" width="250"/>

This accessory:

- Publishes a `BatteryService` to show charging state / battery levels.
- Publishes two subscribable events: `Contact State` and `Low Battery`, for your push alerting pleasure.

Due to HS500 UPS management interface being very simple, the plugin works by calling a shell script that queries the simple HTML interface and returns an JSON record with the appropriate values. This step could no doubt be integrated into the code directly if you prefer.

# Plugin Configuration

Installed through HomeBridge plugins UI, the settings are fully configurable in the UI.

<img src="https://user-images.githubusercontent.com/784541/83954978-f384d500-a845-11ea-97f8-62992137f1d0.png" width="250"/>

# UPS Management Configuration

This pluging includes a script apc500.sh, which enables the management IP address to be set on an already configured or unconfigured APC HS500. This is useful because APC's supplied utility doesn't work on any modern operating system.

Full documentation about this script is available via lo-tech.co.uk at: https://www.lo-tech.co.uk/wiki/Apc500.sh. This UPS must be connected to the same VLAN as it's broadcast based. The commands are:

- To find a device on the local network: ./apc500.sh -f
- To set the IP to DHCP: ./apc500.sh -s 0.0.0.0
- To set the IP to a fixed address e.g. 192.168.1.10: ./apc500.sh -s 192.168.1.10

