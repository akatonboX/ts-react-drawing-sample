import { Group, Shape, ajustGroup, findShape, isGroup } from "./core";
import { MenuItem, Selection } from "./ui";

export class GroupMenuItem implements MenuItem{

  label: React.ReactNode;

  constructor(label: React.ReactNode){
    this.label = label;
  }
  isEnable(shapes: Shape[], selection: Selection): boolean {
    return selection.shapes.length > 1;
  }

  onClick(shapes: Shape[], selection: Selection, onChanged: (shapes: Shape[]) => void){

    //■新しいGroupを作成
    const group: Group = {
      id: window.crypto.randomUUID(),
      type: "group",
      left: 0,
      top: 0, 
      width: 0,
      height: 0,
      backgroudColor: "white",
      lineColor: "black",
      angle: 0,
      shapes: selection.shapes.map(shape => shapes.find(item => item.id === shape.id) as Shape).filter(item => item != null),
    }
    ajustGroup(group);

    //■グループ化対象の内、最も上位のshapeIDを取得
    const topShapeId = selection.shapes[selection.shapes.length - 1].id;
    const newShapes = shapes
      .map(item => item.id === topShapeId ? group : item)//最も上位のshapeをgroupと交換
      .filter(item => group.shapes.find(shape => shape.id === item.id) == null)//グループ化対象のshapeを除外

    //■作成したgroupを選択
    selection.set([group]);
    //■変更を通知
    onChanged(newShapes);

  }
}

export class UnGroupMenuItem implements MenuItem{

  label: React.ReactNode;

  constructor(label: React.ReactNode){
    this.label = label;
  }
  isEnable(shapes: Shape[], selection: Selection): boolean {
    return selection.shapes.length === 1 && isGroup(selection.shapes[0]);
  }

  onClick(shapes: Shape[], selection: Selection, onChanged: (shapes: Shape[]) => void){
    //■追加するshapeを構築
    const appendShapes = (selection.shapes[0] as Group).shapes
    .map(item => findShape(shapes, item.id) as Shape)//shapes内のアイテムに交換
    .filter(item => item != null);//nullがあれば除外
    //■新しいshapesを生成
    const newShapes = shapes
      .map(item => item.id === selection.shapes[0].id ? appendShapes : item)
      .flat();//交換したappendShapesをflat化

    //■選択の変更
    selection.set(appendShapes);

    //■変更を通知
    onChanged(newShapes);

  }
}