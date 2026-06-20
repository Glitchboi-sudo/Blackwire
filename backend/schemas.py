#!/usr/bin/env python3
"""
Blackwire - Modelos Pydantic compartidos y catálogo de operaciones Chepy.

Módulo puro: solo define modelos de datos y constantes. Sin dependencias internas.
"""

from typing import Optional, List
from pydantic import BaseModel


class Project(BaseModel):
    name: str
    description: Optional[str] = ""


class ScopeRule(BaseModel):
    pattern: str
    rule_type: str = "include"
    enabled: bool = True


class RepeaterRequest(BaseModel):
    name: str
    method: str
    url: str
    headers: dict
    body: Optional[str] = None
    last_response: Optional[dict] = None


class ChepyOperation(BaseModel):
    name: str
    args: dict = {}


class ChepyRecipe(BaseModel):
    input: str
    operations: List[ChepyOperation]


class WsResendRequest(BaseModel):
    url: str
    message: str
    headers: Optional[dict] = None


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class CollectionItemCreate(BaseModel):
    method: str
    url: str
    headers: dict = {}
    body: Optional[str] = None
    var_extracts: List[dict] = []
    position: Optional[int] = None


class CollectionItemExecute(BaseModel):
    variables: dict = {}


# Catálogo de operaciones Chepy expuestas en la UI (allowlist de seguridad:
# solo estas operaciones pueden ejecutarse desde el endpoint /api/chepy/bake).
CHEPY_OPERATIONS = {
    "Encoding": [
        {"name": "base64_encode", "label": "Base64 Encode", "params": []},
        {"name": "base64_decode", "label": "Base64 Decode", "params": []},
        {"name": "url_encode", "label": "URL Encode", "params": []},
        {"name": "url_decode", "label": "URL Decode", "params": []},
        {"name": "html_encode", "label": "HTML Encode", "params": []},
        {"name": "html_decode", "label": "HTML Decode", "params": []},
        {"name": "to_hex", "label": "To Hex", "params": []},
        {"name": "from_hex", "label": "From Hex", "params": []},
        {"name": "to_octal", "label": "To Octal", "params": []},
        {"name": "from_octal", "label": "From Octal", "params": []},
        {"name": "to_binary", "label": "To Binary", "params": []},
        {"name": "from_binary", "label": "From Binary", "params": []},
        {"name": "to_decimal", "label": "To Decimal", "params": []},
        {"name": "from_decimal", "label": "From Decimal", "params": []},
        {"name": "to_charcode", "label": "To Charcode", "params": []},
        {"name": "from_charcode", "label": "From Charcode", "params": [
            {"name": "delimiter", "type": "string", "default": " ", "label": "Delimiter"}
        ]},
    ],
    "Hashing": [
        {"name": "md5", "label": "MD5", "params": []},
        {"name": "sha1", "label": "SHA-1", "params": []},
        {"name": "sha2_256", "label": "SHA-256", "params": []},
        {"name": "sha2_512", "label": "SHA-512", "params": []},
        {"name": "hmac_hash", "label": "HMAC", "params": [
            {"name": "key", "type": "string", "default": "", "label": "Key"},
            {"name": "digest", "type": "select", "default": "sha256",
             "options": ["md5", "sha1", "sha256", "sha512"], "label": "Digest"}
        ]},
        {"name": "crc32_checksum", "label": "CRC32", "params": []},
    ],
    "Encryption": [
        {"name": "rot_13", "label": "ROT13", "params": []},
        {"name": "xor", "label": "XOR", "params": [
            {"name": "key", "type": "string", "default": "", "label": "Key"}
        ]},
        {"name": "jwt_decode", "label": "JWT Decode", "params": []},
    ],
    "Compression": [
        {"name": "zlib_compress", "label": "Zlib Compress", "params": []},
        {"name": "zlib_decompress", "label": "Zlib Decompress", "params": []},
        {"name": "gzip_compress", "label": "Gzip Compress", "params": []},
        {"name": "gzip_decompress", "label": "Gzip Decompress", "params": []},
    ],
    "Data Format": [
        {"name": "str_to_json", "label": "Parse JSON", "params": []},
        {"name": "json_to_yaml", "label": "JSON to YAML", "params": []},
        {"name": "yaml_to_json", "label": "YAML to JSON", "params": []},
    ],
    "String": [
        {"name": "reverse", "label": "Reverse", "params": []},
        {"name": "upper_case", "label": "Uppercase", "params": []},
        {"name": "lower_case", "label": "Lowercase", "params": []},
        {"name": "trim", "label": "Trim", "params": []},
        {"name": "count_occurances", "label": "Count Occurrences", "params": [
            {"name": "pattern", "type": "string", "default": "", "label": "Pattern"}
        ]},
        {"name": "find_replace", "label": "Find / Replace", "params": [
            {"name": "pattern", "type": "string", "default": "", "label": "Find"},
            {"name": "repl", "type": "string", "default": "", "label": "Replace"},
        ]},
        {"name": "regex_search", "label": "Regex Search", "params": [
            {"name": "pattern", "type": "string", "default": "", "label": "Pattern"}
        ]},
        {"name": "length", "label": "Length", "params": []},
        {"name": "escape_string", "label": "Escape String", "params": []},
        {"name": "unescape_string", "label": "Unescape String", "params": []},
    ],
}
