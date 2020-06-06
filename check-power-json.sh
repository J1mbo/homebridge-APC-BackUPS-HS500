#!/bin/bash
# This script uses apc.sh to check the status of BackUPS HS-500
# And outputs the status as an json record

STATUS="/tmp/apc-500-status.tmp"
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

# Generate json
echo '{'
echo '    "upsstatus":"'$UPSSTATUS'",'
echo '    "load":'$LOAD','
echo '    "batterylevel":'$BATTERYLEVEL','
echo '    "batterystatus":"'$BATTERYSTATUS'",'
echo '    "runtime":'$RUNTIME','
echo '    "lasttest":"'$LASTTEST'",'
echo '    "lasttransfer":"'$LASTTRANSFER'"'
echo '}'

# garbage collector
rm -f $STATUS
