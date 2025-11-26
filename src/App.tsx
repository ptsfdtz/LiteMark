import './App.css';
import { useEffect } from 'react';
import Layout from './components/Layout/Layout';
import Joyride, { Step } from 'react-joyride';
import { useState } from 'react';

const steps: Step[] = [
  {
    target: 'body',
    content: '欢迎使用 liteMark！下面将带您快速了解主要功能。',
    placement: 'center',
  },
  {
    target: '.' + '' + 'toolbar', // 工具栏
    content: '这里是工具栏，支持常用 Markdown 编辑操作。',
    placement: 'bottom',
  },
  {
    target: '.' + 'editor', // 编辑器
    content: '在这里输入和编辑 Markdown 内容。',
    placement: 'right',
  },
  {
    target: '.preview-container', // 预览区
    content: '这里实时预览 Markdown 渲染效果。',
    placement: 'left',
  },
  {
    target: '.settingsButton', // 设置按钮
    content: '点击这里可打开设置面板，调整主题和工作目录。',
    placement: 'right-start',
  },
  {
    target: '.folderButton', // 最近的文件按钮
    content: '点击这里可打开最近的文件。',
    placement: 'left-start',
  },
];

function getCssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

function App() {
  const [run, setRun] = useState(false);
  useEffect(() => {
    const seen = localStorage.getItem('joyride_seen');
    if (!seen) setRun(true);
  }, []);

  const handleJoyrideCallback = (data: any) => {
    if (data.status === 'finished' || data.status === 'skipped') {
      localStorage.setItem('joyride_seen', '1');
      setRun(false);
    }
  };

  const joyrideStyles = {
    options: {
      zIndex: 10000,
      primaryColor: getCssVar('--text-color', '#414141'),
      backgroundColor: getCssVar('--background-color', '#fff'),
      textColor: getCssVar('--text-color', '#222'),
      arrowColor: getCssVar('--background-color', '#fff'),
      overlayColor: 'rgba(0,0,0,0.3)',
    },
    buttonNext: {
      backgroundColor: getCssVar('--blockquote-text', '#414141'),
      color: '#fff',
      borderRadius: 4,
    },
    buttonBack: {
      color: getCssVar('--blockquote-text', '#414141'),
    },
  };
  return (
    <>
      <Joyride
        steps={steps}
        run={run}
        continuous
        showSkipButton
        showProgress
        styles={joyrideStyles}
        callback={handleJoyrideCallback}
      />
      {/* <button
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 11000,
          background: getCssVar("--primary-color", "#409EFF"),
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "8px 18px",
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
        onClick={() => {
          localStorage.removeItem("joyride_seen");
          setRun(true);
        }}
      >
        测试引导
      </button> */}
      <Layout />
    </>
  );
}

export default App;
