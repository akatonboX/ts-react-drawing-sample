import React from "react";
import styles from "./expandableLayout.module.scss";
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';


export interface ExpandableLayoutRef{
  rootElement: HTMLDivElement | null;
  open: () => void;
  close: () => void;
}
function _ExpandableLayout<T>(
  props: {
    popupIconButton?: React.ReactNode,
    popup: React.ReactNode,
    children: React.ReactNode,
  },
  ref: React.Ref<ExpandableLayoutRef>
) 
{
  //■ルートエレメント
  const rootElement = React.useRef<HTMLDivElement>(null);

  //■popupの開閉を制御するstate
  const [isOpen, setIsOpen] = React.useState(false);

  //■refを登録
  React.useImperativeHandle(ref, () => {
    return {
      rootElement: rootElement.current,
      open: () => {setIsOpen(true);},
      close: () => {setIsOpen(false);},
    };
  });

  //■展開したパネル以外がクリックされたときにパネルを閉じるイベントを設定
  React.useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      //■refが取得できていないなら終了
      if(rootElement.current == null)return;

      //■イベントのターゲット要素が自身の外ならポップアップを閉じる
      if (event.target instanceof Element) {
        if (!rootElement.current.contains(event.target)) {
          setIsOpen(false);
        }
      }

    }
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
    }
  }, []);
  
  //■右詰めか左詰めかの判断
  const isLeft = (() => {
    //■rootElementが取得できていないか、popupがオープンされていないときは値に意味はないので終了。
    if(rootElement.current == null || !isOpen)return true;

    //■自身の中央位置を取得
    const rootBoundingClientRect = rootElement.current.getBoundingClientRect();
    const center = rootBoundingClientRect.left + (rootBoundingClientRect.width / 2);

    //■ウィンドウ幅の1/2より、中央位置が小さかったら左より。
    return center < window.innerWidth / 2;
  })();
  return (
    <div ref={rootElement} className={styles.root} >
      <div>
        <div>{/* 入力コンポーネント */}
          {props.children}
        </div>
        <div onClick={e => {setIsOpen(!isOpen)}}>{props.popupIconButton != null ? props.popupIconButton : <ArrowDropDownIcon />}</div>
      </div>
      {isOpen ?
        <div className={styles.popup}>
          <div style={{left: (isLeft ? 0 : undefined), right: (isLeft ? undefined : 0)}}>
            {props.popup}
          </div>
        </div>
      : <></>}
    </div>
  );
}

export const ExpandableLayout = React.forwardRef(_ExpandableLayout);