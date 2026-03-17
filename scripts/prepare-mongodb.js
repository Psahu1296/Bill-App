const { MongoBinary } = require('mongodb-memory-server-core');
const fs = require('fs');
const path = require('path');

async function prepare() {
    const binDir = path.join(__dirname, '../build-resources/bin');
    if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
    }

    const platforms = [
        { os: 'win32', arch: 'x64' },
        { os: 'darwin', arch: 'x64' },
        { os: 'darwin', arch: 'arm64' },
        { os: 'linux', arch: 'x64' }
    ];

    const version = '7.0.14';

    for (const { os, arch } of platforms) {
        console.log(`Preparing MongoDB for ${os} ${arch}...`);
        
        // Use binary option to force cross-platform download
        const instancePath = await MongoBinary.getPath({
            version,
            downloadDir: path.join(process.env.HOME || process.env.USERPROFILE, '.cache/mongodb-binaries'),
            platform: os,
            arch,
        });

        const destName = os === 'win32' ? `mongod-${os}-${arch}.exe` : `mongod-${os}-${arch}`;
        const destPath = path.join(binDir, destName);

        console.log(`Copying ${instancePath} to ${destPath}`);
        fs.copyFileSync(instancePath, destPath);
        
        if (os !== 'win32') {
            fs.chmodSync(destPath, 0o755);
        }
    }
    console.log('MongoDB binaries prepared successfully.');
}

prepare().catch(err => {
    console.error('Failed to prepare MongoDB binaries:', err);
    process.exit(1);
});


