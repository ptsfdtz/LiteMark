import './App.css';
import { useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout/Layout';
import {
  Joyride,
  STATUS,
  type EventData,
  type Options,
  type Step,
  type Styles,
} from 'react-joyride';
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
        target: '[data-tour="editor"]', // 编辑器
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

  const handleJoyrideEvent = (data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      localStorage.setItem('joyride_seen', '1');
      setRun(false);
    }
  };

  const joyrideOptions: Partial<Options> = {
    zIndex: 10000,
    primaryColor: getCssVar('--text-color', '#414141'),
    backgroundColor: getCssVar('--background-color', '#fff'),
    textColor: getCssVar('--text-color', '#222'),
    arrowColor: getCssVar('--background-color', '#fff'),
    overlayColor: 'rgba(0,0,0,0.3)',
    showProgress: true,
    buttons: ['back', 'primary', 'skip'],
  };
  const joyrideStyles: Partial<Styles> = {
    buttonPrimary: {
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
        options={joyrideOptions}
        locale={{
          back: t('tour.back'),
          close: t('tour.close'),
          last: t('tour.last'),
          next: t('tour.next'),
          skip: t('tour.skip'),
        }}
        styles={joyrideStyles}
        onEvent={handleJoyrideEvent}
      />
      <Layout />
    </>
  );
}

export default App;
