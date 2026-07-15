// Manija de redimensionado por arrastre. Horizontal por defecto (llama onDrag(dx));
// con vertical={true} arrastra en el eje Y y llama onDrag(dy).

const { useRef } = React;

export function ResizeHandle({ onDrag, vertical = false }) {
  const ref = useRef(null);
  const cbRef = useRef(onDrag);
  cbRef.current = onDrag;
  const handleMouseDown = (e) => {
    e.preventDefault();
    let last = vertical ? e.clientY : e.clientX;
    const el = ref.current;
    if (el) el.classList.add('dragging');
    document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev) => {
      const pos = vertical ? ev.clientY : ev.clientX;
      const delta = pos - last;
      last = pos;
      cbRef.current(delta);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (el) el.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  return React.createElement('div', {
    ref,
    className: vertical ? 'resize-v' : 'resize-h',
    onMouseDown: handleMouseDown,
  });
}
