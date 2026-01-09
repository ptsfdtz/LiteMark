import './App.css';
import { useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout/Layout';
import Joyride, { Step } from 'react-joyride';
import { useI18n } from './locales/useI18n';

function getCssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

function App() {
  const { t } = useI18n();
  const [run, setRun] = useState(false);
  const steps = useMemo<Step[]>(
    () => [
      {
        target: 'body',
        content: t('tour.welcome'),
        placement: 'center',
      },
      {
        target: '.' + '' + 'toolbar', // 工具栏
        content: t('tour.toolbar'),
        placement: 'bottom',
      },
      {
        target: '.' + 'editor', // 编辑器
        content: t('tour.editor'),
        placement: 'right',
      },
      {
        target: '.preview-container', // 预览区
        content: t('tour.preview'),
        placement: 'left',
      },
      {
        target: '.settingsButton', // 设置按钮
        content: t('tour.settings'),
        placement: 'right-start',
      },
      {
        target: '.folderButton', // 最近的文件按钮
        content: t('tour.recentFiles'),
        placement: 'left-start',
      },
    ],
    [t],
  );
  useEffect(() => {
    const seen = localStorage.getItem('joyride_seen');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) setRun(true);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        locale={{
          back: t('tour.back'),
          close: t('tour.close'),
          last: t('tour.last'),
          next: t('tour.next'),
          skip: t('tour.skip'),
        }}
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
