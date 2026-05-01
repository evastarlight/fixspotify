import { defineEntity, InferEntity, p } from "@mikro-orm/core";
import { ResourceSchema } from "../baseEntities/resource.js";
import { TrackSchema } from "./track.entity.js";
import { ArtistSchema } from "./artist.entity.js";

export const AlbumSchema = defineEntity({
    name: "Album",
    extends: ResourceSchema,
    properties: {
        title: p.string(),
        artists: () => p.manyToMany(ArtistSchema), // this is the owning side
        tracks: () => p.oneToMany(TrackSchema).mappedBy("album")
    }
})

export class Album extends AlbumSchema.class { }
AlbumSchema.setClass(Album)
