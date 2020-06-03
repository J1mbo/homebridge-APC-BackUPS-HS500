#!/bin/bash
# This script uses apc.sh to check the status of BackUPS HS-500
# And outputs the status as an XML record

STATUS="/tmp/apc-500-status.tmp"				# temp file for operational status - battery level etc
OUTPUTFILE="/tmp/apc500status.xml"
UPS=$1

# get status values from the primitive web UI
# logger "Getting UPS Status from $UPS"
curl -sl "http://$UPS/status.cgi" | tr -dc '[:print:]\n' > $STATUS

# Extract the unit operating status fields - battery level etc
LOAD="$(cat $STATUS | grep -o '[0-9]*&nbsp;Watts' | grep -o '[0-9]*')"
BATTERYLEVEL="$(cat $STATUS | grep -o '[0-9]*&nbsp;%' | grep -o '[0-9]*')"
RUNTIME="$(cat $STATUS | grep -o '[0-9]*&nbsp;minutes' | grep -o '[0-9]*')"
BATTERYSTATUS="$(cat $STATUS | egrep -o 'Charged|Charging|Discharged|Discharging')"
UPSSTATUS="$(cat $STATUS | egrep -o 'On&nbsp;Line|On&nbsp;Battery' | sed 's/&nbsp;/ /g')"
LASTTEST="$(cat $STATUS | egrep -o 'Result of last self-test is:.*(Passed|Failed)</font>' | egrep -o '(Passed|Failed)')"
LASTTRANSFER="$(cat $STATUS | egrep -o 'No&nbsp;Transfer|Blackout' | sed 's/&nbsp;/ /g')"

# log process
# logger "UPS Status $UPSSTATUS, $RUNTIME minutes remaining (load: $LOAD Watts)"

# Generate XML
echo '<?xml version="1.0" encoding="UTF-8" ?>'
echo '<root>'
echo '  <0>'
echo '    <UPSSTATUS>'$UPSSTATUS'</UPSSTATUS>'
echo '    <LOAD>'$LOAD'</LOAD>'
echo '    <BATTERYLEVEL>'$BATTERYLEVEL'</BATTERYLEVEL>'
echo '    <BATTERYSTATUS>'$BATTERYSTATUS'</BATTERYSTATUS>'
echo '    <RUNTIME>'$RUNTIME'</RUNTIME>'
echo '    <LASTTEST>'$LASTTEST'</LASTTEST>'
echo '    <LASTTRANSFER>'$LASTTRANSFER'</LASTTRANSFER>'
echo '  </0>'
echo '</root>'

# garbage collector
rm -f $STATUS
