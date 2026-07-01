import MenuBar from "./components/MenuBar/MenuBar";
import Toolbar from "./components/Toolbar/Toolbar";
import CADCanvas from "./components/Canvas/CADCanvas";
import LayerPanel from "./components/LayerPanel/LayerPanel";
import BlockPanel from "./components/BlockPanel/BlockPanel";
import CommandBar from "./components/CommandBar/CommandBar";
import "./App.css";

export default function App() {
  return (
    <div className="app-shell">
      <div className="app-vertical">
        <MenuBar />
        <div className="workspace">
          <Toolbar />
          <div className="canvas-area">
            <CADCanvas />
            <CommandBar />
          </div>
          <div className="right-panels">
            <LayerPanel />
            <BlockPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
