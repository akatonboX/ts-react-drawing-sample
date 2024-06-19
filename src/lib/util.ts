//** クライアント座標を変換 */
export function clientToDrawingPoint(svgElement: SVGSVGElement, clientX: number, clientY: number){
  const rect = svgElement.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}
