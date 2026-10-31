const { exec } = require('child_process');
exec('npm install jose', { cwd: 'C:\\Users\\LucasCilento\\echo\\echo-api' }, (error, stdout, stderr) => {
  if (error) {
    console.error('npm install error:', error.message);
    console.error('stderr:', stderr);
    process.exit(1);
  }
  console.log('jose installed successfully');
  console.log('stdout:', stdout);
});