import child_process from "child_process";
import log from "./log";
let volume: (newVolume: string) => void;
if (typeof process.env.VOLUME_IP !== "undefined" && typeof process.env.VOLUME_PORT !== "undefined") {
    volume = (newVolume: string) => {
        log(volume, `Sending ${newVolume}...`);
        const command = "/usr/bin/ssh";
        const args = [
            "-p",
            process.env.VOLUME_PORT!,
            process.env.VOLUME_IP!,
            "/mnt/c/Program\\ Files/AutoHotkey/AutoHotkey.exe",
            "C:/Users/sirve/Documents/opt/volume.ahk",
            newVolume
        ];

        const res = child_process.spawnSync(command, args, {
            timeout: 5000
        });
        if (res.status === 0) {
            log(volume, `${newVolume} sent successfully.`);
        } else {
            log(volume, "Volume setting was unsuccessful. Info below.");
            log(volume, `command: ${command} ${args.join(" ")}`);
            log(volume, `status: ${res.status}`);
            log(volume, `stdout: ${res.stdout}`);
            log(volume, `stderr: ${res.stderr}`);
        }
    };
    log(volume, `Volume setting enabled! VOLUME_IP=${process.env.VOLUME_IP} VOLUME_PORT=${process.env.VOLUME_PORT}`);
} else {
    volume = () => {};
    log(function volume() {}, "No IP or PORT supplied, volume disabled.");
}

export default volume;
