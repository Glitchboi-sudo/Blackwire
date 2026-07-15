// FilterBuilder — constructor visual de filtros para principiantes.
// Genera HTTPQL válido a partir de filas campo/operador/valor y lo escribe en
// la barra de filtros (el usuario ve el HTTPQL real y aprende la sintaxis).

const { useState, useRef, useEffect } = React;

// Campos amigables → HTTPQL (namespace.field). type define operadores y formato.
const FIELDS = [
  { key: 'method', label: 'Método', ns: 'req', field: 'method', type: 'enum',
    options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] },
  { key: 'code', label: 'Código de estado', ns: 'resp', field: 'code', type: 'number', placeholder: '404' },
  { key: 'host', label: 'Host', ns: 'req', field: 'host', type: 'text', placeholder: 'example.com' },
  { key: 'path', label: 'Ruta', ns: 'req', field: 'path', type: 'text', placeholder: '/api/login' },
  { key: 'ext', label: 'Extensión', ns: 'req', field: 'ext', type: 'text', placeholder: 'js' },
  { key: 'query', label: 'Query string', ns: 'req', field: 'query', type: 'text', placeholder: 'id=' },
  { key: 'tls', label: 'HTTPS', ns: 'req', field: 'tls', type: 'bool' },
  { key: 'reqlen', label: 'Tamaño request', ns: 'req', field: 'len', type: 'number', placeholder: '1000' },
  { key: 'resplen', label: 'Tamaño response', ns: 'resp', field: 'len', type: 'number', placeholder: '10000' },
];

const TEXT_OPS = [
  { op: 'cont', label: 'contiene' },
  { op: 'ncont', label: 'no contiene' },
  { op: 'eq', label: 'es igual a' },
  { op: 'ne', label: 'no es' },
  { op: 'regex', label: 'coincide (regex)' },
];
const NUM_OPS = [
  { op: 'eq', label: '=' },
  { op: 'ne', label: '≠' },
  { op: 'gt', label: '>' },
  { op: 'gte', label: '≥' },
  { op: 'lt', label: '<' },
  { op: 'lte', label: '≤' },
];
const ENUM_OPS = [
  { op: 'eq', label: 'es' },
  { op: 'ne', label: 'no es' },
];
const BOOL_OPS = [{ op: 'eq', label: 'es' }];

function opsForField(f) {
  if (f.type === 'number') return NUM_OPS;
  if (f.type === 'enum') return ENUM_OPS;
  if (f.type === 'bool') return BOOL_OPS;
  return TEXT_OPS;
}

function defaultRow() {
  return { id: Math.random().toString(36).slice(2), fieldKey: 'method', op: 'eq', value: 'GET' };
}

// Formatea una fila como cláusula HTTPQL. Devuelve '' si está incompleta.
function rowToClause(row) {
  const f = FIELDS.find(x => x.key === row.fieldKey);
  if (!f) return '';
  const head = `${f.ns}.${f.field}.${row.op}:`;
  if (f.type === 'number') {
    if (row.value === '' || isNaN(Number(row.value))) return '';
    return head + String(Number(row.value));
  }
  if (f.type === 'bool') {
    return head + (row.value === 'false' ? 'false' : 'true');
  }
  // text / enum → valor entre comillas (escapando comillas internas)
  if (row.value === '' || row.value == null) return '';
  return head + '"' + String(row.value).replace(/"/g, '\\"') + '"';
}

function buildQuery(rows, combinator) {
  const clauses = rows.map(rowToClause).filter(Boolean);
  return clauses.join(combinator === 'OR' ? ' OR ' : ' AND ');
}

export function FilterBuilder({ setSearch }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([defaultRow()]);
  const [combinator, setCombinator] = useState('AND');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const preview = buildQuery(rows, combinator);

  const updateRow = (id, patch) => setRows(rs => rs.map(r => {
    if (r.id !== id) return r;
    const next = { ...r, ...patch };
    // Al cambiar de campo, ajustar operador y valor por defecto según el tipo.
    if (patch.fieldKey) {
      const f = FIELDS.find(x => x.key === patch.fieldKey);
      const ops = opsForField(f);
      next.op = ops[0].op;
      if (f.type === 'enum') next.value = f.options[0];
      else if (f.type === 'bool') next.value = 'true';
      else next.value = '';
    }
    return next;
  }));

  const addRow = () => setRows(rs => [...rs, defaultRow()]);
  const removeRow = (id) => setRows(rs => (rs.length <= 1 ? rs : rs.filter(r => r.id !== id)));

  const apply = () => {
    if (preview) setSearch(preview);
    setOpen(false);
  };

  return (
    <div className="flt-builder-wrap" ref={wrapRef}>
      <div className={'flt-tog' + (open ? ' act' : '')} onClick={() => setOpen(o => !o)} title="Constructor de filtros">🔧</div>
      {open && (
        <div className="flt-builder-dd">
          <div className="flt-builder-hd">
            <span>Constructor de filtros</span>
            <select className="sel" value={combinator} onChange={e => setCombinator(e.target.value)}>
              <option value="AND">Coincidir con TODAS</option>
              <option value="OR">Coincidir con CUALQUIERA</option>
            </select>
          </div>

          {rows.map(row => {
            const f = FIELDS.find(x => x.key === row.fieldKey);
            const ops = opsForField(f);
            return (
              <div key={row.id} className="flt-builder-row">
                <select className="sel" value={row.fieldKey} onChange={e => updateRow(row.id, { fieldKey: e.target.value })}>
                  {FIELDS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                </select>
                <select className="sel" value={row.op} onChange={e => updateRow(row.id, { op: e.target.value })}>
                  {ops.map(o => <option key={o.op} value={o.op}>{o.label}</option>)}
                </select>
                {f.type === 'enum' ? (
                  <select className="sel" value={row.value} onChange={e => updateRow(row.id, { value: e.target.value })}>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'bool' ? (
                  <select className="sel" value={row.value} onChange={e => updateRow(row.id, { value: e.target.value })}>
                    <option value="true">sí</option>
                    <option value="false">no</option>
                  </select>
                ) : (
                  <input className="inp" value={row.value}
                    type={f.type === 'number' ? 'number' : 'text'}
                    placeholder={f.placeholder || ''}
                    onChange={e => updateRow(row.id, { value: e.target.value })} />
                )}
                <button className="btn btn-sm btn-d flt-builder-del" onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1} title="Quitar condición">×</button>
              </div>
            );
          })}

          <button className="btn btn-sm btn-s flt-builder-add" onClick={addRow}>+ Agregar condición</button>

          <div className="flt-builder-preview">
            <span className="flt-builder-preview-lbl">Filtro generado</span>
            <code>{preview || '(vacío)'}</code>
          </div>

          <div className="flt-builder-acts">
            <button className="btn btn-sm btn-s" onClick={() => { setRows([defaultRow()]); setCombinator('AND'); }}>Reiniciar</button>
            <button className="btn btn-sm btn-p" onClick={apply} disabled={!preview}>Aplicar filtro</button>
          </div>
        </div>
      )}
    </div>
  );
}
