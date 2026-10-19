package com.dineinone.waiter.core

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.jsonPrimitive

/**
 * Decodes a JSON value to String whether it arrives as a number or a string.
 * Postgres bigint PKs (e.g. tables.id) come back as numbers; we treat all ids as strings.
 */
object AnyToStringSerializer : KSerializer<String> {
    override val descriptor = PrimitiveSerialDescriptor("AnyToString", PrimitiveKind.STRING)
    override fun deserialize(decoder: Decoder): String {
        val je = (decoder as JsonDecoder).decodeJsonElement()
        return je.jsonPrimitive.content
    }
    override fun serialize(encoder: Encoder, value: String) = encoder.encodeString(value)
}
