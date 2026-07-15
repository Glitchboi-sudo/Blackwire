// WikiPanel — wiki in-app (versión condensada de la wiki de GitHub).
// Contenido estático en Markdown renderizado offline. No recibe estado de
// __appCtx; mantiene su propia selección de página local.

import { WIKI_PAGES } from '../../utils/wikiContent.js';
import { mdToHtml } from '../../utils/miniMarkdown.js';

const { useState, useMemo } = React;

export function WikiPanel() {
  const [pageId, setPageId] = useState(WIKI_PAGES[0].id);
  const page = WIKI_PAGES.find((p) => p.id === pageId) || WIKI_PAGES[0];
  const html = useMemo(() => mdToHtml(page.md), [page]);

  return (
    <div className="wiki-wrap">
      <div className="wiki-nav">
        <div className="wiki-nav-title">Wiki</div>
        {WIKI_PAGES.map((p) => (
          <div
            key={p.id}
            className={'wiki-nav-item' + (p.id === pageId ? ' act' : '')}
            onClick={() => setPageId(p.id)}
          >
            {p.title}
          </div>
        ))}
      </div>
      <div className="wiki-body">
        <div className="wiki-doc" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
