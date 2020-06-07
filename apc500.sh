#!/bin/bash
# UPS Management script for APC 500 HS
# Depends on (sudo apt install) net-tools, apring, xxd, socat
#
# -f - to Find and show detail of the device
# -s - to Set the IP address of the device (0.0.0.0 for DHCP)
# -n - to set the Name of the device
# Command line parameters - what are we doing?
for i in "$@"
do
case $i in
 -f*|--find*)
 FUNCTION="FIND"
 ;;
 -s=*|--setip=*)
 FUNCTION="SETIP"
 IPADDRESS="${i#*=}"
 shift # past argument=value
 ;;
 -n=*|--setname=*)
 FUNCTION="SETNAME"
 NAME="${i#*=}"
 shift # past argument=value
 ;;
 *)
 # unknown option
 ;;
esac
done
if [ "$FUNCTION" = "FIND" ]; then
 # Find UPS via broadcast
 DATA="$(echo '11 50 00 A0 10 50 43 43' | xxd -r -p | socat - UDP4-DATAGRAM:255.255.255.255:9950,so-broadcast,sourceport=9951 | tr -dc '[:print:]\n')"
 MODEL=${DATA:9:15}
 SERIAL=${DATA:24:12}
 MACADD=${DATA:37:12}
 TMP=${MACADD,,}
 MACADDR=${TMP:0:2}:${TMP:2:2}:${TMP:4:2}:${TMP:6:2}:${TMP:8:2}:${TMP:10:2}
 TMP=${DATA:52}
 NAME=${TMP::-1}
 # And lookup the MAC from ARP cache
 IPADD="$(arp -an | grep "$MACADDR" | egrep -o '[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*')"
 # Likely, there was nothing there. Check, and use arping (needs root) if we need to
 case "$IPADD" in
 "") IPADD="$(arping "$MACADDR" -c 2 -i eth0 | egrep -o -m 1 '[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*' | head -1)" ;;
 esac
# Print out the information
 echo Model: $MODEL
 echo Serial: $SERIAL
 echo Name: $NAME
 echo MAC Address: $MACADDR
# Now check again to see if we have an IP address. If we do, we can get run-time information, eg battery level etc
 case "$IPADD" in
 "")
 echo "IP Address: Not known"
 ;;
 *)
 echo "IP Address: $IPADD"
 ./check-power-json.sh $IPADD
 esac
fi;
if [ "$FUNCTION" = "SETIP" ]; then
 # Work out IP in Hex
 IPDEC="$(echo "$IPADDRESS" | sed 's/\./ /g')"
 TMP="$(printf '%02x ' $IPDEC ; echo)"
 IPHEX=${TMP::-1}
 RESULT="$(echo '12 50 00 a0 98 05 45 43 f5 f4 34 f6 '"$IPHEX" | xxd -r -p | socat - UDP4-DATAGRAM:255.255.255.255:9950,so-broadcast | tr -dc '[:print:]\n')"
 case "$RESULT" in
 "") echo "UPS did not respond.";;
 *) echo "UPS acknowledged command."
 esac
fi;
if [ "$FUNCTION" = "SETNAME" ]; then
 TMP="$(echo "$NAME" | xxd -p )"
 NAMEHEX=${TMP::-2}
 RESULT="$(echo '12 50 00 a0 10 08 45 43 f5 '"$NAMEHEX"' 00' | xxd -r -p | socat - UDP4-DATAGRAM:255.255.255.255:9950,so-broadcast | tr -dc '[:print:]\n')"
 case "$RESULT" in
 "") echo "UPS did not respond.";;
 *) echo "UPS acknowledged command."
 esac
fi;
# End of script.

