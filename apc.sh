#!/bin/bash
# This script allows you to control APC BACK-UPS HS 500 from command line;
# Please install cURL before using; script works with web-interface of UPS;
# Copyright (c) 2011-2015 Anton Bagayev, abagayev@gmail.com, http://dontgiveafish.com
#
# Updated by James Pearce, June 2020, to report status as JSON block, to enable it's use in 
# HomeBridge integration plugin: https://github.com/J1mbo/homebridge-APC-Back-UPS-HS500
#

COOKIES=$(mktemp)					# cookie temp file
CFG=$(mktemp)						# temp file to get current configuration
STATUS=$(mktemp)					# temp file for operational status - battery level etc
# automatically delete the tmp files on exit...
trap "{ rm -f $COOKIES; rm -f $CFG; rm -f $STATUS; }" EXIT

function onoffreboot {
# this function will help us to humanize statuses and options
# we use it this way: onoffreboot $1
# where $1 is number or humanized word  (for ex, 2=reboot)

        case "$1" in
	on)	echo 0;;
	off)	echo 1;;
	reboot)	echo 2;;
	0)	echo on;;
	1)	echo off;;
	2)	echo reboot;;
	toggle)	echo toggle;;
	esac

}

function outputvalue {
# this function will help us get to know current configuration
# use it this way: outputvalue $1 $2 
# where  $1 is filename, $2 is output var (for ex, q is var for output3)

	if [ $(grep -ca "Checked..name=$2 value=0" $1) = 1 ]; then echo 0; fi
	if [ $(grep -ca "Checked..name=$2 value=1" $1) = 1 ]; then echo 1; fi
	if [ $(grep -ca "Checked..name=$2 value=2" $1) = 1 ]; then echo 2; fi
}

function toggle {
# this function will help us to toggle configuration
# use it this way: toggle $1
# where $1 is configuration(0 or 1)

        case "$1" in
	0)	echo 1;;
	1)	echo 0;;
	*)	echo $1;;
	esac
}

# parse options
# show help and exit if nothing
if [ -e $2 ]; then {
	echo "Usage: "
	echo "  apc.sh ip=[ip-addres] status";
	echo "or"
	echo "  apc.sh [output1=on|off|toggle|reboot] [output2=on|off|toggle|reboot] [output3=on|off|toggle|reboot] user=[username] pass=[passcode]";
	echo ""
	echo "Note: [passcode] is the apc encoded password and must not include any digits (characters only)"
	exit;
}
fi

# parse query
for arg in "$@"; do
  case "$arg" in
	ip=*)			UPS="$(echo $arg | cut -d'=' -f2)";;
	output1=*)		o1=$(onoffreboot `echo $arg | cut -d'=' -f2`);;
	output2=*)		o2=$(onoffreboot `echo $arg | cut -d'=' -f2`);;
	output3=*)		o3=$(onoffreboot `echo $arg | cut -d'=' -f2`);;
	status)			status=TRUE;;
	user=*)			USERNAME="$(echo $arg | cut -d'=' -f2)";;
	pass=*)			PASSWORD="$(echo $arg | cut -d'=' -f2)";;
  esac
done

## toggle values if toggle is in query
#if [ "$o1" = "toggle" ]; then o1=$(toggle $(outputvalue $CFG o)); fi
#if [ "$o2" = "toggle" ]; then o2=$(toggle $(outputvalue $CFG p)); fi
#if [ "$o3" = "toggle" ]; then o3=$(toggle $(outputvalue $CFG q)); fi

# get current oulet states
curl -sl "http://$UPS/CFG1.CGI" > $CFG
if [ -e $o1 ]; then o1=$(outputvalue $CFG o); fi
if [ -e $o2 ]; then o2=$(outputvalue $CFG p); fi
if [ -e $o3 ]; then o3=$(outputvalue $CFG q); fi

if [ -n "$status" ]; then
	# status returns the UPS status only
	# get UPS status page from web-control
	curl -sl "http://$UPS/status.cgi" | tr -dc '[:print:]\n' > $STATUS

	# Extract the unit operating status fields - battery level etc
	LOAD="$(cat $STATUS | grep -o '[0-9]*&nbsp;Watts' | grep -o '[0-9]*')"
	BATTERYLEVEL="$(cat $STATUS | grep -o '[0-9]*&nbsp;%' | grep -o '[0-9]*')"
	RUNTIME="$(cat $STATUS | grep -o '[0-9]*&nbsp;minutes' | grep -o '[0-9]*')"
	BATTERYSTATUS="$(cat $STATUS | egrep -o 'Charged|Charging|Discharged|Discharging')"
	UPSSTATUS="$(cat $STATUS | egrep -o 'On&nbsp;Line|On&nbsp;Battery' | sed 's/&nbsp;/ /g')"
	LASTTEST="$(cat $STATUS | egrep -o 'Result of last self-test is:.*(Passed|Failed)</font>' | egrep -o '(Passed|Failed)')"
	LASTTRANSFER="$(cat $STATUS | egrep -o 'No&nbsp;Transfer|Blackout' | sed 's/&nbsp;/ /g')"

        # Default values to provide valid json object if nothing is returned from UPS
	[ -z "$LOAD" ] && LOAD=0
	[ -z "$BATTERYLEVEL" ] && BATTERYLEVEL=0
	[ -z "$RUNTIME" ] && RUNTIME=0

	echo '{'
	echo '    "output1":"'$(onoffreboot $o1)'",'
        echo '    "output2":"'$(onoffreboot $o2)'",'
        echo '    "output3":"'$(onoffreboot $o3)'",'
	echo '    "upsstatus":"'$UPSSTATUS'",'
	echo '    "load":'$LOAD','
	echo '    "batterylevel":'$BATTERYLEVEL','
        echo '    "batterystatus":"'$BATTERYSTATUS'",'
	echo '    "runtime":'$RUNTIME','
	echo '    "lasttest":"'$LASTTEST'",'
	echo '    "lasttransfer":"'$LASTTRANSFER'"'
	echo '}'
else
	# power outlet control requested...
	# login first
	curl -slo /dev/null --cookie $COOKIES "http://$UPS/2?n=$USERNAME&T=$PASSWORD"
	# install configuration
	curl -slo /dev/null --cookie $COOKIES "http://$UPS/3?s=1&a=2&u=10&l=16&o=$o1&p=$o2&q=$o3&S2=Apply"
	# logout
	curl -slo /dev/null --cookie $COOKIES "http://$UPS/Logon.cgi"
fi

# garbage collector - remove temp files
#rm -f $CFG
#rm -f $COOKIES
#rm -f $STATUS
