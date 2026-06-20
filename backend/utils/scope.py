#!/usr/bin/env python3
"""
match_scope: decide si una URL está dentro del scope según reglas include/exclude.

Función pura (recibe las reglas como argumento, no toca estado global).
"""

import logging
import re
from urllib.parse import urlparse
from typing import List

logger = logging.getLogger('blackwire')


def match_scope(url: str, rules: List[dict]) -> bool:
    logger.debug('Scope check: url=%s rules=%d', url, len(rules))
    if not rules:
        return True
    parsed = urlparse(url)
    host = parsed.netloc
    in_scope = False
    has_include = any(r.get("rule_type") == "include" and r.get("enabled", True) for r in rules)
    for rule in rules:
        if not rule.get("enabled", True):
            continue
        pattern = rule.get("pattern", "")
        rule_type = rule.get("rule_type", "include")
        regex = pattern.replace(".", r"\.").replace("*", ".*")
        try:
            if re.match(regex, host) or re.match(regex, url):
                if rule_type == "include":
                    in_scope = True
                elif rule_type == "exclude":
                    return False
        except Exception:
            continue
    return in_scope if has_include else True
