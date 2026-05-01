import { spawn } from "child_process";
import { rmSync } from "fs";
import path from "path";

export class Convert {
    public static convertToWebp(filePath: string, outDir: string) {
        return new Promise<string>((resolve, reject) => {
            const ext = path.extname(filePath)
            const fileName = path.basename(filePath)
            const newPath = path.resolve(outDir, `${fileName.replace(ext, ".webp")}`)
            const proc = spawn("ffmpeg", ["-i", `"${filePath}"`, "-y", "-c:v", "libwebp", "-vf", "scale=256:256", `"${newPath}"`])

            proc.once("error", (error) => console.error(error))

            proc.once("exit", (code) => {
                rmSync(filePath)
                resolve(newPath)
            })
        })

    }
}