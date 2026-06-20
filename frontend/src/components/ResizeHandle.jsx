// Manija de redimensionado horizontal (arrastre). Llama onDrag(dx) en cada movimiento.

const { useRef } = React;

export function ResizeHandle({ onDrag }) {
  const ref = useRef(null);
  const cbRef = useRef(onDrag);
  cbRef.current = onDrag;
  const handleMouseDown = (e) => {
    e.preventDefault();
    let lastX = e.clientX;
    const el = ref.current;
    if (el) el.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev) => {
      const dx = ev.clientX - lastX;
      lastX = ev.clientX;
      cbRef.current(dx);
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
  return React.createElement('div', { ref, className: 'resize-h', onMouseDown: handleMouseDown });
}
