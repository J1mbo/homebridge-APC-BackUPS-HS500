[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Donate](https://badgen.net/badge/donate/paypal)](https://paypal.me/HomebridgeJ1mbo)

# homebridge-APC-Back-UPS-HS500

A HomeBridge interface for APC's 'Structured Cabling' Back-UPS HS500 UPS device, capable of monitoring, controlling and configuring the UPS.

Key features:

- Monitoring the UPS mains inlet via Contact Sensor accessory, which can generate alerts. If the UPS switches to battery power, the Contact Sensor is reported as 'open' and you will receive a notification in iOS on a phone or watch.
- Monitoring of the battery charge level and charging status through Battery Service. Access this through the Contact Sensor settings within the Home app.
- Reporting of UPS load and run-time, which is done through Light Sensor accessories as there isn't really any plain 'gauge' we can add in HomeKit, and custom properties are not shown in the Home app.
- Control of the three UPS outputs - these are exposed as Outlet accessories (see screenshot below). This control can also be disabled individually, to prevent accidental power-off for example or a core switch or similar.
- Automatic configuration of UPS management interface for static IP or DHCP. If you've never managed to configure the HS500 network interface because APCs lousy tool only ran on Windows 98/2000, this plugin can do it for you as it initialises.
- Auto-discovery of configured UPS network address (provided only one HS500 is on the network).

<img src="https://user-images.githubusercontent.com/784541/83963920-34f69e00-a8a1-11ea-9d1b-cb2c673c23e2.png" width="250"/>
<img src="https://user-images.githubusercontent.com/784541/84699513-8a8a1500-af49-11ea-8dc1-f507a912a9e1.png" width="250"/>
<img src="https://user-images.githubusercontent.com/784541/84699747-fb313180-af49-11ea-85a5-b80c2a01cb1e.png" width="250"/>

Credits: This plugin was developed using cr3ative/homebridge-apcaccess as a starting point.

Subscribable events:

- Contact State
- Low Battery

# Plugin Configuration

Installed through HomeBridge plugins UI, the settings are fully configurable in the UI (see screenshot above).

# Issues and Contact

Please raise an issue should you come across one via Github.

