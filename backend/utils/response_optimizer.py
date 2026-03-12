"""
Response optimizer for handling large request/response bodies efficiently.
Prevents browser freezing by intelligently truncating and managing large content.
"""

import json
import gzip
import base64
from typing import Dict, Any, Optional, Tuple

# Size limits in bytes
MAX_PREVIEW_SIZE = 100 * 1024  # 100KB for preview
MAX_INLINE_SIZE = 1 * 1024 * 1024  # 1MB max inline (beyond this, require explicit load)
TRUNCATE_AT = 50 * 1024  # 50KB - truncate long strings at this point for preview


def detect_content_type(content: str, headers: Optional[Dict] = None) -> str:
    """Detect content type from headers or content."""
    if headers:
        content_type = headers.get('content-type', headers.get('Content-Type', ''))
        if content_type:
            return content_type.lower()

    # Try to detect from content
    if not content:
        return 'text/plain'

    content_start = content[:500].strip()

    if content_start.startswith('{') or content_start.startswith('['):
        try:
            json.loads(content_start[:100])
            return 'application/json'
        except:
            pass

    if content_start.startswith('<?xml') or content_start.startswith('<'):
        return 'text/xml'

    return 'text/plain'


def smart_truncate(content: str, max_size: int, content_type: str = 'text/plain') -> Tuple[str, bool]:
    """
    Intelligently truncate content based on type.
    Returns (truncated_content, was_truncated)
    """
    if not content or len(content) <= max_size:
        return content, False

    # For JSON, try to truncate at a valid boundary
    if 'json' in content_type:
        try:
            # Try to find a good truncation point (after a complete object/array)
            truncate_point = max_size
            # Look for }, or ] near the truncation point
            for i in range(max_size, max(0, max_size - 1000), -1):
                if content[i] in ['}', ']', ',']:
                    truncate_point = i + 1
                    break

            return content[:truncate_point] + '\n... [truncated]', True
        except:
            pass

    # For XML/HTML, try to truncate at a tag boundary
    elif 'xml' in content_type or 'html' in content_type:
        truncate_point = max_size
        # Look for > near the truncation point
        for i in range(max_size, max(0, max_size - 500), -1):
            if content[i] == '>':
                truncate_point = i + 1
                break
        return content[:truncate_point] + '\n... [truncated]', True

    # Default: truncate at max_size
    return content[:max_size] + '\n... [truncated]', True


def get_content_size(content: Optional[str]) -> int:
    """Get size of content in bytes."""
    if not content:
        return 0
    return len(content.encode('utf-8'))


def compress_content(content: str) -> str:
    """Compress content using gzip and return base64 encoded."""
    if not content:
        return ""

    compressed = gzip.compress(content.encode('utf-8'))
    return base64.b64encode(compressed).decode('ascii')


def decompress_content(compressed: str) -> str:
    """Decompress base64 encoded gzip content."""
    if not compressed:
        return ""

    compressed_bytes = base64.b64decode(compressed.encode('ascii'))
    return gzip.decompress(compressed_bytes).decode('utf-8')


def optimize_request_detail(
    request_data: Dict[str, Any],
    include_full: bool = False,
    max_preview: int = MAX_PREVIEW_SIZE
) -> Dict[str, Any]:
    """
    Optimize request detail for transmission.

    Args:
        request_data: The full request data
        include_full: If True, include full content (up to MAX_INLINE_SIZE)
        max_preview: Maximum size for preview content

    Returns:
        Optimized request data with metadata about truncation
    """
    result = request_data.copy()

    # Process request body
    body = result.get('body', '')
    body_size = get_content_size(body)
    body_type = detect_content_type(body, result.get('headers'))

    if body and not include_full:
        if body_size > max_preview:
            truncated_body, was_truncated = smart_truncate(body, max_preview, body_type)
            result['body'] = truncated_body
            result['body_truncated'] = True
        else:
            result['body_truncated'] = False
    else:
        result['body_truncated'] = False

    result['body_size'] = body_size
    result['body_type'] = body_type

    # Process response body
    response_body = result.get('response_body', '')
    response_body_size = get_content_size(response_body)
    response_headers = result.get('response_headers', {})
    response_body_type = detect_content_type(response_body, response_headers)

    if response_body and not include_full:
        if response_body_size > max_preview:
            truncated_response, was_truncated = smart_truncate(response_body, max_preview, response_body_type)
            result['response_body'] = truncated_response
            result['response_body_truncated'] = True
        else:
            result['response_body_truncated'] = False
    else:
        result['response_body_truncated'] = False

    result['response_body_size'] = response_body_size
    result['response_body_type'] = response_body_type

    # Add flags for frontend
    result['requires_full_load'] = (body_size > max_preview) or (response_body_size > max_preview)
    result['is_large'] = (body_size > MAX_INLINE_SIZE) or (response_body_size > MAX_INLINE_SIZE)

    return result


def format_size(size_bytes: int) -> str:
    """Format size in bytes to human readable string."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"
