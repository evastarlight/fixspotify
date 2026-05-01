import { defineEntity, InferEntity, p } from "@mikro-orm/core";
import { ResourceSchema } from "../baseEntities/resource.js";
import { TrackSchema } from "./track.entity.js";
import { AlbumSchema } from "./album.entity.js";

export const ArtistSchema = defineEntity({
    name: "Artist",
    extends: ResourceSchema,
    properties: {
        name: p.string(),
        tracks: () => p.manyToMany(TrackSchema).mappedBy("artists"),
        albums: () => p.manyToMany(AlbumSchema).mappedBy("artists")
    }
})

export class Artist extends ArtistSchema.class { }
ArtistSchema.setClass(Artist)