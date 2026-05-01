import { defineEntity, p } from "@mikro-orm/core";
import { ResourceSchema } from "../baseEntities/resource.js";

export const ImageSchema = defineEntity({
    name: "Image",
    extends: ResourceSchema,
    properties: {
        hash: p.string().index(true),
        from: p.enum(() => ImageSource)
    }
})

export class Image extends ImageSchema.class { }
ImageSchema.setClass(Image)

export enum ImageSource {
    Spotify,
    YouTube,
    Tidal
}
