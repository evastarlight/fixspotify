import { createWriteStream, existsSync, mkdirSync, openSync, writeFile, writeFileSync } from "fs";
import path, { resolve } from "path";
import { Image, ImageSource } from "./entities/image.entity.js";
import { EntityRepository } from "@mikro-orm/postgresql";
import { database } from "../index.js";
import { Logger } from "@gurrrrrrett3/protocol";
import fetch from "node-fetch"
import { createHash } from "crypto";
import { Probe } from "../util/probe.js";
import { Convert } from "../util/convert.js";

export default class ImageManager {


    public static readonly IMAGE_STORAGE_PATH = path.resolve("./storage/images")
    public static readonly IMAGE_TEMP_PATH = path.resolve("/tmp/fixspotify/images")

    public static logger = new Logger("ImageManager")
    public static repo: EntityRepository<Image>

    public static async init() {
        if (!existsSync(this.IMAGE_STORAGE_PATH)) {
            mkdirSync(this.IMAGE_STORAGE_PATH, { recursive: true })
        }

        if (!existsSync(this.IMAGE_TEMP_PATH)) {
            mkdirSync(this.IMAGE_TEMP_PATH, { recursive: true })
        }

        this.repo = database.em.getRepository(Image)

        this.logger.info(`${await this.repo.count()} images in storage`)

    }

    public static async fetchImage(href: string, from: ImageSource) {
        const res = await fetch(href, {
            headers: {
                accept: "image/webp",
            }
        })

        if (res.status != 200) {
            return
        }

        const buffer = await res.buffer()
        const hash = createHash("sha256").update(buffer).digest().toString("hex")

        const oldImageEntity = await this.repo.findOne({
            hash
        })

        if (oldImageEntity) {
            return
        }

        this.repo.create({
            hash,
            from,
        })


        writeFileSync(resolve(this.IMAGE_TEMP_PATH, `${hash}.unknown`), buffer)
        // await new Promise<void>((rs, rj) => writeFile(resolve(this.IMAGE_TEMP_PATH, `${hash}.unknown`), buffer, (err) => err ? rj(err) : rs()))
        const newpath = await Convert.convertToWebp(resolve(this.IMAGE_TEMP_PATH, `${hash}.unknown`), this.IMAGE_STORAGE_PATH)
    }

}