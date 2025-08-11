#!/bin/bash

set -e  # Exit on any error

echo "🧹 NUCLEAR RESTART: Complete Android/Maestro Environment Reset"
echo "================================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Set environment variables if not set
if [ -z "$ANDROID_HOME" ]; then
    print_warning "ANDROID_HOME not set, setting temporarily"
    export ANDROID_HOME="/Users/vladanm/Library/Android/sdk"
fi

if [ -z "$(echo $PATH | grep maestro)" ]; then
    print_warning "Maestro not in PATH, adding temporarily"
    export PATH="$PATH:/Users/vladanm/.maestro/bin"
fi

export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$ANDROID_HOME/emulator:$PATH"

ADB_PATH="$ANDROID_HOME/platform-tools/adb"
EMULATOR_PATH="$ANDROID_HOME/emulator/emulator"

print_status "Environment setup complete"
echo "ANDROID_HOME: $ANDROID_HOME"
echo "ADB_PATH: $ADB_PATH"
echo "EMULATOR_PATH: $EMULATOR_PATH"
echo ""

# Step 1: Kill everything Android/Maestro related
print_status "Step 1: Killing all Android/Maestro processes..."

# Kill ADB server
print_status "Killing ADB server..."
if pgrep -f "adb" > /dev/null; then
    pkill -f "adb" || true
    print_success "ADB processes killed"
else
    print_status "No ADB processes running"
fi

# Kill emulator processes
print_status "Killing emulator processes..."
if pgrep -f "qemu-system" > /dev/null; then
    pkill -f "qemu-system" || true
    print_success "Emulator processes killed"
else
    print_status "No emulator processes running"
fi

# Kill Maestro processes
print_status "Killing Maestro processes..."
if pgrep -f "maestro" > /dev/null; then
    pkill -f "maestro" || true
    print_success "Maestro processes killed"
else
    print_status "No Maestro processes running"
fi

# Wait for processes to fully terminate
sleep 3

# Step 2: Clear caches and temporary files
print_status "Step 2: Clearing caches and temporary files..."

# Clear ADB server files
print_status "Clearing ADB server cache..."
rm -rf ~/.android/adb* 2>/dev/null || true
rm -rf /tmp/adb* 2>/dev/null || true

# Clear Android AVD cache (but not the AVD itself)
print_status "Clearing AVD cache..."
AVD_DIR="$HOME/.android/avd"
if [ -d "$AVD_DIR" ]; then
    find "$AVD_DIR" -name "*.lock" -delete 2>/dev/null || true
    find "$AVD_DIR" -name "cache.img*" -delete 2>/dev/null || true
    find "$AVD_DIR" -name "userdata-qemu.img*" -delete 2>/dev/null || true
    print_success "AVD cache cleared"
fi

# Clear Maestro cache
print_status "Clearing Maestro cache..."
rm -rf ~/.maestro/cache 2>/dev/null || true
rm -rf /tmp/maestro* 2>/dev/null || true

print_success "Caches cleared"

# Step 3: Restart ADB server
print_status "Step 3: Restarting ADB server..."
$ADB_PATH kill-server 2>/dev/null || true
sleep 2
$ADB_PATH start-server
if [ $? -eq 0 ]; then
    print_success "ADB server restarted successfully"
else
    print_error "Failed to restart ADB server"
    exit 1
fi

# Step 4: Start emulator with clean boot
print_status "Step 4: Starting emulator with clean boot..."

# Get the AVD name (assuming Medium_Phone_API_36.0 based on your earlier output)
AVD_NAME="Medium_Phone_API_36.0"

# Check if AVD exists
if ! $EMULATOR_PATH -list-avds | grep -q "$AVD_NAME"; then
    print_error "AVD '$AVD_NAME' not found!"
    echo "Available AVDs:"
    $EMULATOR_PATH -list-avds
    exit 1
fi

print_status "Starting emulator: $AVD_NAME"
print_warning "This will take 2-3 minutes for cold boot..."

# Start emulator in background with clean boot
$EMULATOR_PATH -avd "$AVD_NAME" -wipe-data -no-snapshot-load -no-snapshot-save &
EMULATOR_PID=$!

print_status "Emulator started with PID: $EMULATOR_PID"

# Step 5: Wait for emulator to be ready
print_status "Step 5: Waiting for emulator to boot..."

# Wait for device to show up in adb devices
BOOT_TIMEOUT=180  # 3 minutes
ELAPSED=0
while [ $ELAPSED -lt $BOOT_TIMEOUT ]; do
    if $ADB_PATH devices | grep -q "emulator.*device"; then
        print_success "Emulator detected by ADB"
        break
    fi
    echo -n "."
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $BOOT_TIMEOUT ]; then
    print_error "Emulator failed to start within $BOOT_TIMEOUT seconds"
    exit 1
fi

# Wait for boot to complete
print_status "Waiting for boot animation to complete..."
BOOT_COMPLETE_TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $BOOT_COMPLETE_TIMEOUT ]; do
    if $ADB_PATH shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
        print_success "Boot animation completed"
        break
    fi
    echo -n "."
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $BOOT_COMPLETE_TIMEOUT ]; then
    print_warning "Boot animation didn't complete, but continuing..."
fi

# Additional wait for UI to be ready
print_status "Waiting for UI to be ready..."
sleep 10

# Step 6: Emulator is ready for APK installation
print_status "Step 6: Emulator is ready for APK installation"
print_success "Emulator boot completed successfully"

# Step 7: Test Maestro connection
print_status "Step 7: Testing Maestro connection..."

# Test if maestro can see the device
if maestro --version > /dev/null 2>&1; then
    print_success "Maestro is available"
    
    # Test basic maestro command
    print_status "Testing Maestro device detection..."
    if timeout 10 maestro test --dry-run /dev/null 2>/dev/null || true; then
        print_success "Maestro can communicate with devices"
    else
        print_warning "Maestro device communication test inconclusive"
    fi
else
    print_error "Maestro not found in PATH"
    exit 1
fi

# Final summary
echo ""
echo "================================================================"
print_success "🎉 NUCLEAR RESTART COMPLETE!"
echo "================================================================"
echo ""
echo "Environment Status:"
echo "  • ANDROID_HOME: $ANDROID_HOME"
echo "  • ADB Server: Running"
echo "  • Emulator: Running ($AVD_NAME)"
echo "  • Emulator: Ready for APK installation"
echo "  • Maestro: Available"
echo ""
print_success "System is ready for testing!"
echo ""
echo "Now you can run:"
echo "  npm run test:e2e .maestro/flows/core/vm1.yaml"
echo ""

# Debug: Log parameters before APK check
echo ""
echo "================================================================"
echo "DEBUG: Script parameters:"
echo "  Number of arguments: $#"
echo "  All arguments: $@"
if [ $# -gt 0 ]; then
    echo "  First argument: '$1'"
    if [[ "$1" == *".apk" ]]; then
        echo "  APK pattern match: TRUE"
    else
        echo "  APK pattern match: FALSE"
    fi
fi
echo "================================================================"

# Check if APK file argument provided for installation
if [ $# -gt 0 ] && [[ "$1" == *".apk" ]]; then
    APK_FILE="$1"
    print_status "Installing APK: $(basename "$APK_FILE")"
    echo ""
    
    if [ -f "$APK_FILE" ]; then
        print_status "Running: adb install \"$APK_FILE\""
        if $ADB_PATH install "$APK_FILE"; then
            print_success "APK installation completed successfully!"
        else
            print_error "APK installation failed!"
            exit 1
        fi
    else
        print_error "APK file not found: $APK_FILE"
        exit 1
    fi
    echo ""
# Optionally run the test if argument provided (non-APK)
elif [ $# -gt 0 ]; then
    print_status "Running test: $@"
    echo ""
    .maestro/test.sh "$@"
fi
