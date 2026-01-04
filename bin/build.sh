#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

############################################################
# Extract Time-Config source files
############################################################

# Run extraction script to clone repo and copy files with selective removal
./bin/time-config/extract.sh

############################################################
# Build ROMs
############################################################

# Clear output folder
rm -rf ./src/out
mkdir ./src/out

############################################################
# Build I2CB ROM
############################################################

# Compile Acorn BBC Micro target
echo ""
echo "*** Building I2CB ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/out.ssd -title I2C \
    -S INCBUS="./src/inc/bus/B.asm" \
    -S INCRTC="./src/inc/rtc/DS3231.asm" \
    -S INCTARGET="./src/inc/targets/B.asm" \
    -S INCCONFIG="./src/configure/inc/Configure.inc" \
    -D ALTBASE=0 \
    -D PAD=1 \
    -D INC_TESTS=0 \
    -D INC_CONFIG=0 \
    -o "I2CB"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/out.ssd ./src/out/b

############################################################
# Build I2CE ROM
############################################################

# Compile Acorn Electron target
echo ""
echo "*** Building I2CE ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/out.ssd -title I2C \
    -S INCBUS="./src/inc/bus/E.asm" \
    -S INCRTC="./src/inc/rtc/DS3231.asm" \
    -S INCTARGET="./src/inc/targets/E.asm" \
    -S INCCONFIG="./src/configure/inc/Configure.inc" \
    -D ALTBASE=0 \
    -D PAD=1 \
    -D INC_TESTS=0 \
    -D INC_CONFIG=0 \
    -o "I2CE"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/out.ssd ./src/out/e

############################################################
# Build I2EAP6 ROM
############################################################

# Compile Acorn Electron AP6 target
echo ""
echo "*** Building I2EAP6 ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/out.ssd -title I2C \
    -S INCBUS="./src/inc/bus/EAP6.asm" \
    -S INCRTC="./src/inc/rtc/PCF8583.asm" \
    -S INCTARGET="./src/inc/targets/EAP6.asm" \
    -S INCCONFIG="./src/configure/inc/Configure.inc" \
    -D ALTBASE=0 \
    -D PAD=0 \
    -D INC_TESTS=0 \
    -D INC_CONFIG=1 \
    -o "I2CEAP6"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/out.ssd ./src/out/ap6

############################################################
# Build test ROMs (all commands plus I2CTEST)
############################################################

# Compile I2CTEST-only BBC Micro target
echo ""
echo "*** Building T.I2CB ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/testb.ssd -title I2C \
    -S INCBUS="./src/inc/bus/B.asm" \
    -S INCRTC="./src/inc/rtc/DS3231.asm" \
    -S INCTARGET="./src/inc/targets/B.asm" \
    -S INCCONFIG="./src/configure/inc/Configure.inc" \
    -D ALTBASE=0 \
    -D PAD=1 \
    -D INC_TESTS=1 \
    -D INC_CONFIG=0 \
    -o "T.I2CB"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/testb.ssd ./src/out/testb

# Compile I2CTEST-only Electron target
echo ""
echo "*** Building T.I2CE ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/teste.ssd -title I2C \
    -S INCBUS="./src/inc/bus/E.asm" \
    -S INCRTC="./src/inc/rtc/DS3231.asm" \
    -S INCTARGET="./src/inc/targets/E.asm" \
    -S INCCONFIG="./src/configure/inc/Configure.inc" \
    -D ALTBASE=0 \
    -D PAD=1 \
    -D INC_TESTS=1 \
    -D INC_CONFIG=0 \
    -o "T.I2CE"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/teste.ssd ./src/out/teste

# Compile I2CTEST-only Electron AP6 target
echo ""
echo "*** Building T.I2CEAP6 ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/testap6.ssd -title I2C \
    -S INCBUS="./src/inc/bus/EAP6.asm" \
    -S INCRTC="./src/inc/rtc/PCF8583.asm" \
    -S INCTARGET="./src/inc/targets/EAP6.asm" \
    -S INCCONFIG="./src/configure/inc/Configure.inc" \
    -D ALTBASE=0 \
    -D PAD=0 \
    -D INC_TESTS=1 \
    -D INC_CONFIG=1 \
    -o "T.I2CEAP6"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/testap6.ssd ./src/out/testap6

############################################################
# Build configure-less ROMs (all commands except configure)
############################################################

# Compile configure-less BBC Micro target
echo ""
echo "*** Building C.I2CB ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/configb.ssd -title I2C \
    -S INCBUS="./src/inc/bus/B.asm" \
    -S INCRTC="./src/inc/rtc/DS3231.asm" \
    -S INCTARGET="./src/inc/targets/B.asm" \
    -S INCCONFIG="./src/configure/inc/Configure.inc" \
    -D ALTBASE=0 \
    -D PAD=1 \
    -D INC_TESTS=0 \
    -D INC_CONFIG=0 \
    -o "C.I2CB"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/configb.ssd ./src/out/configb

# Compile configure-less Electron target
echo ""
echo "*** Building C.I2CE ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/confige.ssd -title I2C \
    -S INCBUS="./src/inc/bus/E.asm" \
    -S INCRTC="./src/inc/rtc/DS3231.asm" \
    -S INCTARGET="./src/inc/targets/E.asm" \
    -S INCCONFIG="./src/configure/inc/Configure.inc" \
    -D ALTBASE=0 \
    -D PAD=1 \
    -D INC_TESTS=0 \
    -D INC_CONFIG=0 \
    -o "C.I2CE"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/confige.ssd ./src/out/confige

# Compile configure-less Electron AP6 target
# Note: AP6 uses DFS, so use C. prefix (capital C for DFS format)
echo ""
echo "*** Building C.I2CEAP6 ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/configap6.ssd -title I2C \
    -S INCBUS="./src/inc/bus/EAP6.asm" \
    -S INCRTC="./src/inc/rtc/PCF8583.asm" \
    -S INCTARGET="./src/inc/targets/EAP6.asm" \
    -S INCCONFIG="./src/configure/inc/Configure.inc" \
    -D ALTBASE=0 \
    -D PAD=0 \
    -D INC_TESTS=0 \
    -D INC_CONFIG=1 \
    -o "C.I2CEAP6"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/configap6.ssd ./src/out/configap6c

############################################################
# Build i2c.ssd (includes both production and test ROMs)
############################################################

# Always delete the old SSD to avoid trailing dot issues
echo ""
echo "*** Building I2C.SSD ***"
rm -f ./dist/i2c.ssd
# Create ./dist/i2c.ssd using mmbutils
./bin/mmbutils/beeb blank_ssd ./dist/i2c.ssd
# Add production ROMs to ssd
./bin/mmbutils/beeb putfile ./dist/i2c.ssd ./src/out/ap6/I2CEAP6 ./src/out/b/I2CB ./src/out/e/I2CE
# Add test ROMs to ssd (add individually to ensure they're all included)
./bin/mmbutils/beeb putfile ./dist/i2c.ssd ./src/out/testb/T.I2CB
./bin/mmbutils/beeb putfile ./dist/i2c.ssd ./src/out/teste/T.I2CE
./bin/mmbutils/beeb putfile ./dist/i2c.ssd ./src/out/testap6/T.I2CEAP6
# Add configure-less ROMs to ssd
./bin/mmbutils/beeb putfile ./dist/i2c.ssd ./src/out/configb/C.I2CB
./bin/mmbutils/beeb putfile ./dist/i2c.ssd ./src/out/confige/C.I2CE
./bin/mmbutils/beeb putfile ./dist/i2c.ssd ./src/out/configap6c/C.I2CEAP6
./bin/mmbutils/beeb title ./dist/i2c.ssd i2crom

############################################################
# Output individual ROMs to the dist folder
############################################################

# Copy production ROMs to dist folder
cp ./src/out/b/I2CB ./dist/i2cb.rom
cp ./src/out/e/I2CE ./dist/i2ce.rom
cp ./src/out/ap6/I2CEAP6 ./dist/i2ceap6.rom

# Copy test ROMs to dist folder
cp ./src/out/testb/T.I2CB ./dist/i2cbt.rom
cp ./src/out/teste/T.I2CE ./dist/i2cet.rom
cp ./src/out/testap6/T.I2CEAP6 ./dist/i2ceap6t.rom

# Copy configure-less ROMs to dist folder
cp ./src/out/configb/C.I2CB ./dist/i2cbc.rom
cp ./src/out/confige/C.I2CE ./dist/i2cec.rom
cp ./src/out/configap6c/C.I2CEAP6 ./dist/i2ceap6c.rom

################################################################################
# Update Dev Folders used with real target machines via UPURSFS
################################################################################
echo ""
echo "*** Updating Dev Folders ***"
rm -rf ./dev/roms
./bin/mmbutils/beeb getfile ./dist/i2c.ssd ./dev/roms
for file in ./dev/roms/I2C*.; do
    if [ -f "$file" ]; then
        mv "$file" "${file%.}"
    fi
done
for file in ./dev/roms/I2C*..inf; do
    if [ -f "$file" ]; then
        mv "$file" "${file%..inf}.inf"
    fi
done
cp ./dev/roms/I2C* ./dev/eap6

# Copy test ROMs to dev/eap6 for hardware testing
echo ""
echo "*** Copying Test ROMs to Dev Folder ***"
cp ./src/out/testb/T.I2CB ./dev/eap6/
cp ./src/out/testb/T.I2CB.inf ./dev/eap6/ 2>/dev/null || true
cp ./src/out/teste/T.I2CE ./dev/eap6/
cp ./src/out/teste/T.I2CE.inf ./dev/eap6/ 2>/dev/null || true
cp ./src/out/testap6/T.I2CEAP6 ./dev/eap6/
cp ./src/out/testap6/T.I2CEAP6.inf ./dev/eap6/ 2>/dev/null || true

# Copy configure-less ROMs to dev/eap6 for hardware testing
echo ""
echo "*** Copying Configure-less ROMs to Dev Folder ***"
cp ./src/out/configb/C.I2CB ./dev/eap6/
cp ./src/out/configb/C.I2CB.inf ./dev/eap6/ 2>/dev/null || true
cp ./src/out/confige/C.I2CE ./dev/eap6/
cp ./src/out/confige/C.I2CE.inf ./dev/eap6/ 2>/dev/null || true
cp ./src/out/configap6c/C.I2CEAP6 ./dev/eap6/
cp ./src/out/configap6c/C.I2CEAP6.inf ./dev/eap6/ 2>/dev/null || true