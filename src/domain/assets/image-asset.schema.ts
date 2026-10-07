import {
    IMAGE_ASSET_KINDS,
    IMAGE_INPUT_TYPES,
    type ImageAssetEntity,
} from "./image-asset"
import { z } from "zod"

export const imageAssetKindSchema = z.enum(IMAGE_ASSET_KINDS)
export const imagePublicIdSchema = z.string().regex(/^[a-f0-9]{32}$/)
export const imageAssetStateSchema = z.enum(["ready", "deleting"])
export type ImageAssetState = z.infer<typeof imageAssetStateSchema>

export const imageAssetDtoSchema = z.strictObject({
    id: z.string(),
    kind: imageAssetKindSchema,
    contentType: z.enum(IMAGE_INPUT_TYPES),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    bytes: z.number().int().min(1),
    url: z.string(),
    createdAt: z.string(),
})
export type ImageAssetDto = z.infer<typeof imageAssetDtoSchema>
export function projectImageAsset(asset: ImageAssetEntity): ImageAssetDto {
    return imageAssetDtoSchema.parse({
        id: asset.id,
        kind: asset.kind,
        contentType: asset.contentType,
        width: asset.width,
        height: asset.height,
        bytes: asset.bytes,
        url: asset.publicUrl,
        createdAt: asset.createdAt,
    })
}
