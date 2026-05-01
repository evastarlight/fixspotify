import { exec } from "child_process";

export class Probe {
    public static getImageInfo(path: string) {
        return new Promise((resolve, reject) => {
            const proc = exec(`ffprobe "${path}"`)

            proc.once("error", (code) => reject(`probe exited with code ${code}`))

            proc.on("message", (msg) => {
                const message = msg.toString()

                console.log(`// ${message}`)
            })
        })

    }
}