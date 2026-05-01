import { defineEntity, InferEntity, p } from "@mikro-orm/core";
import { ResourceSchema } from "../baseEntities/resource.js";
import { AlbumSchema } from "./album.entity.js";
import { ArtistSchema } from "./artist.entity.js";

export const TrackSchema = defineEntity({
    name: "Track",
    extends: ResourceSchema,
    properties: {
        title: p.string(),
        artists: () => p.manyToMany(ArtistSchema), // this is the owning side
        album: () => p.manyToOne(AlbumSchema)
    }
})

export class Track extends TrackSchema.class { }
TrackSchema.setClass(Track)
