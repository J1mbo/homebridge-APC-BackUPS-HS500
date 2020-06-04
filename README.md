# homebridge-APC-Back-UPS-HS500

** Note: work in progress **

A HomeBridge interface for APC's 'Structured Cabling' Back-UPS HS500 UPS device.

The plugin creates a Contact Sensor, which is capable of reporting state only, which is normally in the CLOSED state. If the UPS switches to battery power, the Contact Sensor reports OPEN state. Hence, alerts can be generated on Apple HomeKit device (in particular the watch). The battery charge percentage is also reported within the sensor (viewable on iPhone) along with a Low Battery alert.

Credits: This plugin was developed using cr3ative/homebridge-apcaccess as a starting point.

<img src="https://user-images.githubusercontent.com/1850718/75247783-a0bd6b00-57ca-11ea-9391-0db0afdaf2cf.PNG" width="250"/>

This accessory:

- Publishes a `BatteryService` to show charging state / battery levels.
- Publishes two subscribable events: `Contact State` and `Low Battery`, for your push alerting pleasure.

Due to HS500 UPS management interface being very simple, the plugin works by calling a shell script that queries the simple HTML interface and returns an XML record with the appropriate values. This step could no doubt be integrated into the code directly if you prefer.

Note: requires jsdom (npm install jsdom xmlhttprequest) - this will be installed automatically when the plugin is installed through the HomeBridge UI.

# Configuration

Installed through HomeBridge plugins UI, the settings are fully configurable in the UI.

