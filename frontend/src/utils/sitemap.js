// Site Map: construcción del árbol de hosts/paths a partir de los requests.

export function buildSiteTree(reqs) {
  const tree = {};
  for (const r of reqs) {
    let origin, pathname;
    try {
      const u = new URL(r.url);
      origin = u.origin;
      pathname = u.pathname || '/';
    } catch (e) {
      origin = '(other)';
      pathname = r.url || '/';
    }
    if (!tree[origin]) tree[origin] = { label: origin.replace(/^https?:\/\//, ''), children: {}, reqs: [], methods: new Set(), count: 0 };
    const host = tree[origin];
    host.count++;
    host.methods.add(r.method);
    const segs = pathname.split('/').filter(Boolean);
    if (segs.length === 0) {
      host.reqs.push(r);
    } else {
      let node = host;
      for (let i = 0; i < segs.length; i++) {
        const seg = '/' + segs[i];
        if (!node.children[seg]) node.children[seg] = { label: seg, children: {}, reqs: [], methods: new Set(), count: 0 };
        node = node.children[seg];
        node.count++;
        node.methods.add(r.method);
      }
      node.reqs.push(r);
    }
  }
  return tree;
}

export function collectNodeReqs(node) {
  let all = [...node.reqs];
  for (const child of Object.values(node.children)) {
    all = all.concat(collectNodeReqs(child));
  }
  return all;
}
