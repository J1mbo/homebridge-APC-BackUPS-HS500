# [3.0.0]

*** HomeBridge plugin for APC's HS500 'Structured Cabling' UPS ***

Thank you for trying this plugin! It enables monitoring and control of APC's HS500 UPS from HomeKit, as well as automatic management interface configuration.

Bugfixes:
2.0.3 - Added option to make a donation through Homebridge UI
2.0.2 - README update to reflect verified status
2.0.1 - fixes for spurious validation messages on startup.

Version 3:
- Added support for UPS 'reboot' function - which power-cycles an outlet. This makes it possible to safely power-cycle an outlet even when HomeBridge is itself powered from that outlet (in which case, Homebridge will also be power-cycled).
- Added support to display embedded accessory names correctly on iOS 16/17

Version 2:
Adds support for:
- automatic configuration of UPS management interface for static IP or DHCP
- auto-discovery of UPS network address
- control of the three UPS outputs (by exposing them as outlet devices)
- allows the blocking of UPS outlet control to prevent accidental power-off
- reporting of UPS load and run-time (through lightsensor devices)

Version 1:
Provides:
- monitoring of the UPS mains inlet via Contact Sensor
- monitoring of the battery charge level and charging status through Battery Service.

If you have any feedback or wish to contribute or extend, please log an issue on the GitHub project page.

Depends on curl and, for auto discovery and configuration, net-tools, apring, xxd and socat. Install these packages in your OS (debian, ubuntu, raspbian) using:

sudo apt install curl, net-tools, arping, xxd, socat
