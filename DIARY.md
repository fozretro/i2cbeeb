I2CBeeb Developer Diary
=======================

A reverse-chronological log of development status and milestones for the I2CBeeb ROM project. See the [README](README.md) for current usage, build, and feature documentation.

Status - Release v3.3 In Progress - Configure Refinements and ROM Unit Testing (May/Jun 2026)
--------------------------------------------------------------------------------------------

This work builds on the Jan 2026 configure integration with a number of refinements. **Factory reset** (hold **`R`** on break) and **automatic init** of new or blank NVRAM are now supported, with the NVRAM layout and init marker documented in the [README](README.md). `*LANG` and `*TUBE` are treated as session/local-only and do not write to NVRAM. Time & Config sources are now copied in-tree under [`src/configure/`](src/configure/) (rather than extracted at build time), with AP6-specific edits applied directly. Automated ROM unit tests run during `./bin/build.sh`, complementing the on-machine `*I2CTEST` checks. BBC-family scope and the I²C RTC addresses are also documented in more detail in the README.

Status - Release v3.3 In Progress - Test Framework and Configure Support (Jan 2026)
----------------------------------------------------------------------------------

This release introduces significant enhancements including integration with the Time & Config ROM for configuration management and ROM control features. The `*CONFIGURE` and `*STATUS` commands enable system configuration settings to be stored in NVRAM and applied on boot, while `*INSERT` and `*UNPLUG` commands provide ROM management capabilities. These features are currently available only in Electron AP6 builds due to NVRAM requirements—the PCF8583 RTC chip provides sufficient free RAM for configuration storage, while the DS3231 RTC chip used in BBC Micro and basic Electron builds has no user-accessible RAM. The build system has been updated to disable configure features for BBC and Electron builds, keeping them enabled only for Electron AP6 builds. Additionally, the `*I2CTEST` command has been implemented to provide comprehensive automated testing of I2C functionality across all target platforms. For more information on the test framework, see the Test Framework *I2CTEST section in the [README](README.md).

Status - BeebAsm Migration Complete (Sep 2025)
----------------------------------------------

The main source code has been successfully migrated from Lancs Assembler to BeebAsm and is now located in `/src` (original Lancs Source code is for now in `/src.lancs` but will of course not be updated going forward). This migration represents a significant improvement to the development workflow, eliminating the need to run B-em emulator to compile with the Lancs Assembler. The development process is now much faster with native compilation on modern systems, and provides full compatibility with modern editors such as Visual Studio Code and its 6502 tooling extensions.

The migration required careful attention to assembler syntax differences, particularly converting high/low byte operators from Lancs `>/<` syntax to BeebAsm `HI()/LO()` functions, and fixing endianness issues by converting `DFDB` (big-endian) to `EQUB HI(), LO()` format. The result is byte-for-byte compatibility with the original Lancs Assembler ROMs, verified through comprehensive binary comparison testing using both manual `cmp` commands and custom Python comparison tools.

Status - v3.2 Release
---------------------

This adds support for type 0 OSWORD 14 handling to ensure `*TIME` and `PRINT $TIME` on the BBC Master Compact work - when using the I2CB ROM. This is based on the patch shared [here](https://www.stardot.org.uk/forums/viewtopic.php?p=371328#p371328). I have not tested as yet on the Electron or Electon AP6 targets, but plan to, in theory they have not changed since v3.1 behavior as this was a purely additional change... An ssd and each rom in is under `\dist`. Also of note is that `TIME="bla..."` is not supported yet - more fun later (remind to check `\src.softrc`)

Status - AP6 Target Beta
------------------------

Current status is this variant of the **I2CBeeb ROM by MartinB** is working with a reasonble level of testing with an AP6. However it is currently labelled as **Beta**, so please expect some bugs and report on the thread. It can be downloaded from here `/dist/i2c/I2C32EAP6.rom`. See known issues below. 

SMJoin Compatibility Implementation (Sept 2025)
------------------------------------------------

**I2C ROM Successfully Integrated into Combined AP6 ROM System ✅**

Successfully implemented SMJoin compatibility for the I2C ROM, enabling it to be combined with other AP6 ROMs into a single 16KB ROM image. For detailed technical information about the ROM relocation and chaining mechanisms, see [smjoin.md](/bin/buildap6/smjoin.md).

**Key Achievements:**
- **5 ROMs successfully combined**: AP1v131, AP6v134, TUBEelk, AP6Count, I2C
- **Total size**: 12.8KB (well under 16KB limit with 3.5KB free space)
- **SMJoin compatibility**: Proper relocation data generation and ROM header format
- **Automated build and test pipeline**: Complete workflow from I2C compilation to ROM testing

**Technical Implementation:**
- **Dual compilation process**: Compile ROM at $8000 and $8100 to generate relocation data
- **Node.js relocation tool**: `smjoin-reloc.js` compares builds and generates compressed relocation bitmap
- **Header modification simulation**: Sets header bytes first, then generates bitmap accounting for new candidate bytes
- **Service entry adjustment**: Automatically adjusts addresses for relocation from $8000 to $8100

**Build Tools:**
- `bin/buildap6.sh` - Unified build pipeline script with testing flags
- `bin/buildap6/smjoin-build-i2c-rom.sh` - Builds I2C ROM at both $8000 and $8100
- `bin/buildap6/smjoin-reloc.js` - Node.js tool for relocation data generation
- `bin/buildap6/smjoin-create.js` - Node.js port of BBC BASIC SMJoin tool
- `bin/buildap6/smjoin-test.js` - Playwright-based ROM testing with emulator automation
- `dist/ap6.rom` - Final combined ROM output

**Documentation:**
- `SMJOIN.md` - Comprehensive documentation of ROM relocation and chaining mechanisms
- Detailed explanation of candidate bytes, relocation bitmap generation, and header modification
- Step-by-step instructions for both BBC BASIC and non-BBC BASIC ROMs
- Complete example of relocation bitmap generation process

**Validation:**
- All 5 ROM tests pass: AP6.rom, LatestAP6.rom, I2C.rom, LatestI2C8000.rom
- I2C ROM correctly relocates service address and integrates with AP6 Plus
- Relocation data generation is stable and reproducible
- ROM header format matches SMJoin requirements
- Emulator testing confirms "RH Plus 1" display in combined ROM

**Result:** The I2C ROM is now fully compatible with the SMJoin system and can be combined with other AP6 ROMs into a single 16KB ROM image, providing a complete AP6 ROM solution with automated testing.

TreeROM Version Compatibility Issue (Sep 2025)
-----------------------------------------------

**Issue Identified: TreeROM Version Mismatch Preventing Full ROM Combination**

During testing of the complete AP6 ROM combination (including TreeROM), a version compatibility issue was discovered that prevents the full 5-ROM combination from fitting within the 16KB limit.

**Problem Analysis:**
- **Current TreeROM available**: Version 1.62 (8,704 bytes) - too large for 16KB ROM
- **Original AP6v134t.rom used**: TreeCopy Version 1.61 (8,291 bytes) - fits successfully
- **Available space**: 8,448 bytes (after combining AP1v131, AP6v134, TUBEelk, AP6Count, I2C)
- **Space deficit**: 256 bytes (8,704 - 8,448 = 256 bytes)

**Critical Discovery:**
The original AP6v133t.rom (16,067 bytes) contained **5 ROMs without I2C**:
- AP1v131, AP6v133, TUBEelk, AP6Count, TreeROM
- **No I2C ROM was included in the original combination**

Our current build includes **4 ROMs plus I2C** (12,887 bytes), which leaves 8,448 bytes available for additional ROMs.

**Detailed Size Analysis:**
- **TreeCopy 1.61** (original): 8,291 bytes ✅
- **TreeROM v1.62** (available): 8,704 bytes ❌ (256 bytes too large)
- **Available space**: 8,448 bytes
- **Size difference**: TreeROM v1.62 is 413 bytes larger than TreeCopy 1.61
- **Conclusion**: The 16KB ROM space can accommodate either the original 5 ROMs OR 4 ROMs + I2C, but not all 6 ROMs together

**Root Cause:**
The source code analysis at [MDFS TreeCopier](https://mdfs.net/Software/CommandSrc/FileUtils/TreeCopier/) confirms that TreeCopy version 1.62 source is larger than version 1.61, explaining the size difference. The original AP6v133t.rom was built using the smaller TreeROM version 1.61.

**Current Status:**
- ✅ **4-ROM combination works perfectly**: AP1v131, AP6v134, TUBEelk, AP6Count, I2C (12,887 bytes)
- ❌ **5-ROM combination fails**: Adding TreeROM 1.62 exceeds 16KB limit by 256 bytes
- ✅ **All tests pass**: Complete build and test pipeline functional without TreeROM
- ✅ **Binary analysis confirmed**: AP6v134t.rom contains TreeCopy 1.61 (8,291 bytes), not 1.62

**Reference:** [MDFS TreeCopier Source](https://mdfs.net/Software/CommandSrc/FileUtils/TreeCopier/) - Contains source code for both TreeCopy 1.61 and 1.62 versions.

Merging I2C ROM into the AP6 Main ROM Update (Jan 2025)
-------------------------------------------------------

I have been reviewing the orignal build scripts to merge 4 ROMs into 1 and have got them running via b-em emulator and its co-processor emmulation (previously looks like the scripts ran on an A5000). The src.AP* folders contain files I have been downloading to get to the point where I can reproduce the current merged ROM from the existing ROM images. This will prove I have the build tools/scripts working. There is however a difference I am exploring with Dave Hitchens at present. Once this is resolved I can apply the realloc table to the I2C ROM and merge it in as well (its about 4kb and we have 8kb spare!). Oh and I also spent a chunk of time getting b-em building on my Macbook running Silcon hardware - build in in /bin/b-em.

Leap Year and PCF8583 Year Handling (Jul 2024)
----------------------------------------------

Added logic to handle the PCF8583's limited year storage, which only keeps a 2-bit year (a four-year span). Shadow year and offset values are persisted alongside it and reconciled each time the date/time is read so the full year can be recovered, including across leap-year boundaries and after long periods without power-on. Because this is hard to exercise by waiting for real time to pass, the poke-based test procedures below emulate the relevant conditions (last-year sync with `*TBRK` on and off, and leap-year overflow).

**Note:** These tests actually require the validation logic *I2CTXB commenting out (the `JSR txbval` and `BCS txbpx` in `txbparse`) as the I2CRXB normally does not allow the reserved storage to be written.

**Test 1** - Last year sync properly with the current year (*TBRK off)

    Step 1
    *DSET Mon 01-01-20
    *NOW
    Assert &A10=32 (offset)
    Assert &A11=0  (last year and boot toggle)

    Step 2
    *DSET Mon 01-01-22
    *NOW
    Assert &A10=32  (offset)
    Assert &A11=128 (last year and boot toggle)

    Step 3 - This emulates the machine not having been powered up since 2020
    A%=0
    *I2CTXB 50 #11 A%
    A%=42
    *I2CRXB 50 #11 A%
    Assert A%=0

    Step 4
    *NOW
    Assert: Year is still 22
    Assert: &A11=128

    Step 5
    A%=42
    *I2CRXB 50 #11 A%
    Assert A%=128

**Test 2** - Last year sync properly with the current year (*TBRK on)

    Step 1
    *DSET Mon 01-01-20
    *NOW
    Assert &A10=32 (offset)
    Assert &A11=1  (last year and boot toggle)

    Step 2
    *DSET Mon 01-01-22
    *NOW
    Assert &A10=32  (offset)
    Assert &A11=129 (last year and boot toggle)

    Step 3 - This emulates the machine not having been powered up since 2020
    A%=1
    *I2CTXB 50 #11 A%
    A%=42
    *I2CRXB 50 #11 A%
    Assert A%=1

    Step 4
    *NOW
    Assert: Year is still 22
    Assert: &A11=129

    Step 5
    A%=42
    *I2CRXB 50 #11 A%
    Assert A%=129

**Test 3** - Check it adjusts for wrap around of year in RTC (*TBRK off)

    Step 1
    *DSET Mon 01-01-22
    *NOW
    Assert &A10=32  (offset)
    Assert &A11=128 (last year and boot toggle)

    Step 2
    *DSET Mon 01-01-25
    *NOW
    Assert &A10=36  (offset)
    Assert &A11=64  (last year and boot toggle)

    Step 3 - This emulates the machine not having been powered up since 2022
    A%=32
    *I2CTXB 50 #10 A%
    A%=42
    *I2CRXB 50 #10 A%
    Assert A%=10
    A%=128
    *I2CTXB 50 #11 A%
    A%=42
    *I2CRXB 50 #11 A%
    Assert A%=128

    Step 4
    *NOW
    Assert year is 25
    Assert &A10=36
    Assert &A11=64
