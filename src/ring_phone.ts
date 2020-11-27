import child_process from "child_process";
import path from "path";
import log from "./log";
let ringPhone: () => void;
if (typeof process.env.BTADDRESS !== "undefined") {
    ringPhone = () => {
        log(ringPhone, "Ringing phone...");
        const command = "/usr/bin/bt-obex";
        const args = [
            "-p",
            process.env.BTADDRESS!,
            // It is essential that mock.png has an extension and that isn't zero bytes, otherwise bt-obex will fail to
            // send it.
            path.join(__dirname, "../mock.png")
        ];

        const startTime = Date.now();
        const res = child_process.spawnSync(command, args);
        const duration = Date.now() - startTime;
        if (duration < 2000) {
            log(ringPhone, `WARNING: ${command} ended in ${duration / 1000} seconds, it might have failed.`);
        }
        if (res.status === 0) {
            log(ringPhone, "Phone rang successfully.");
        } else {
        }
            log(ringPhone, "Phone ringing was unsuccessful. Info below.");
            log(ringPhone, `command: ${command} ${args.join(" ")}`);
            log(ringPhone, `status: ${res.status}`);
            log(ringPhone, `stdout: ${res.stdout}`);
            log(ringPhone, `stderr: ${res.stderr}`);
    };
    log(ringPhone, `Phone ringing enabled! BTADDRESS=${process.env.BTADDRESS}`);
} else {
    ringPhone = () => {};
    log(function ringPhone() {}, "No BT address supplied, phone ringing disabled.");
}
export default ringPhone;


