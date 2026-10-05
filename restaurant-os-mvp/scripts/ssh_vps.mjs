#!/usr/bin/env node
import { spawn } from 'child_process';

const cmd = process.argv[2];
if (!cmd) {
  console.error("Usage: ssh_vps.mjs <command>");
  process.exit(1);
}

const expectScript = `
set timeout 120
spawn ssh -o StrictHostKeyChecking=no root@72.61.250.231 ${JSON.stringify(cmd)}
expect {
    "*assword:*" {
        send "Karthiktraders@12\\r"
        exp_continue
    }
    eof
}
catch wait result
set exit_status [lindex $result 3]
exit $exit_status
`;

const proc = spawn('expect', ['-c', expectScript], { stdio: 'inherit' });
proc.on('close', (code) => {
  process.exit(code || 0);
});
