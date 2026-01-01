#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

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
    -D ALTBASE=0 \
    -D PAD=1 \
    -D I2CTEST_ONLY=0 \
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
    -D ALTBASE=0 \
    -D PAD=1 \
    -D I2CTEST_ONLY=0 \
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
    -D ALTBASE=0 \
    -D PAD=0 \
    -D I2CTEST_ONLY=0 \
    -o "I2CEAP6"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/out.ssd ./src/out/ap6

############################################################
# Build i2c.ssd
############################################################

# Always delete the old SSD to avoid trailing dot issues
echo ""
echo "*** Building I2C.SSD ***"
rm -f ./dist/i2c.ssd
# Create ./dist/i2c.ssd using mmbutils
./bin/mmbutils/beeb blank_ssd ./dist/i2c.ssd
# Add outputs above to ssd
./bin/mmbutils/beeb putfile ./dist/i2c.ssd ./src/out/ap6/I2CEAP6 ./src/out/b/I2CB ./src/out/e/I2CE
./bin/mmbutils/beeb title ./dist/i2c.ssd i2crom

############################################################
# Output indivudal roms to the dist folder
############################################################

cp ./src/out/b/I2CB ./dist/i2cb.rom
cp ./src/out/e/I2CE ./dist/i2ce.rom
cp ./src/out/ap6/I2CEAP6 ./dist/i2ceap6.rom

############################################################
# Build I2CTEST-only ROMs (minimal ROMs for merging)
############################################################

# Compile I2CTEST-only BBC Micro target
echo ""
echo "*** Building I2CBT ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/testb.ssd -title I2C \
    -S INCBUS="./src/inc/bus/B.asm" \
    -S INCRTC="./src/inc/rtc/DS3231.asm" \
    -S INCTARGET="./src/inc/targets/B.asm" \
    -D ALTBASE=0 \
    -D PAD=1 \
    -D I2CTEST_ONLY=1 \
    -o "I2CBT"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/testb.ssd ./src/out/testb

# Compile I2CTEST-only Electron target
echo ""
echo "*** Building I2CET ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/teste.ssd -title I2C \
    -S INCBUS="./src/inc/bus/E.asm" \
    -S INCRTC="./src/inc/rtc/DS3231.asm" \
    -S INCTARGET="./src/inc/targets/E.asm" \
    -D ALTBASE=0 \
    -D PAD=1 \
    -D I2CTEST_ONLY=1 \
    -o "I2CET"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/teste.ssd ./src/out/teste

# Compile I2CTEST-only Electron AP6 target
echo ""
echo "*** Building I2CEAP6T ROM ***"
mkdir -p ./src/out/testap6
./bin/beebasm -i ./src/I2CBeeb.asm -title I2C \
    -S INCBUS="./src/inc/bus/EAP6.asm" \
    -S INCRTC="./src/inc/rtc/PCF8583.asm" \
    -S INCTARGET="./src/inc/targets/EAP6.asm" \
    -D ALTBASE=0 \
    -D PAD=0 \
    -D I2CTEST_ONLY=1 \
    -o "I2CEAP6T"
# Copy ROM directly (workaround for beebasm -do issue with I2CTEST_ONLY=1)
cp ./I2CEAP6T ./src/out/testap6/I2CEAP6T
rm -f ./I2CEAP6T

# Copy I2CTEST-only ROMs to dist folder
cp ./src/out/testb/I2CBT ./dist/i2cbt.rom
cp ./src/out/teste/I2CET ./dist/i2cet.rom
cp ./src/out/testap6/I2CEAP6T ./dist/i2ceap6t.rom

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
cp ./src/out/testb/I2CBT ./dev/eap6/
cp ./src/out/testb/I2CBT.inf ./dev/eap6/ 2>/dev/null || true
cp ./src/out/teste/I2CET ./dev/eap6/
cp ./src/out/teste/I2CET.inf ./dev/eap6/ 2>/dev/null || true
cp ./src/out/testap6/I2CEAP6T ./dev/eap6/
# Create .inf file for I2CEAP6T (not created by beebasm without -do)
if [ ! -f ./dev/eap6/I2CEAP6T.inf ]; then
    # Create .inf file (format: $.FILENAME      LOADADDR EXECADDR CRC=XXXX)
    # For ROMs, LOADADDR and EXECADDR are typically 8000 8000
    # CRC will be calculated by the system, using placeholder for now
    echo '$.I2CEAP6T     8000   8000 CRC=0000' > ./dev/eap6/I2CEAP6T.inf
fi