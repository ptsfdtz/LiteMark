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
  const [activeTheme, setActiveTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light',
  );
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

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setActiveTheme(root.getAttribute('data-theme') || 'light');
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const handleJoyrideEvent = (data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      localStorage.setItem('joyride_seen', '1');
      setRun(false);
    }
  };

  const joyrideOptions: Partial<Options> = {
    zIndex: 10000,
    primaryColor: getCssVar('--accent-color', '#287b76'),
    backgroundColor: getCssVar('--paper-bg', '#fff'),
    textColor: getCssVar('--text-color', '#222'),
    arrowColor: getCssVar('--paper-bg', '#fff'),
    overlayColor: 'rgba(0,0,0,0.48)',
    showProgress: true,
    buttons: ['back', 'primary', 'skip'],
  };
  const joyrideStyles: Partial<Styles> = {
    tooltip: {
      width: 340,
      padding: 0,
      color: getCssVar('--text-color', '#30383b'),
      backgroundColor: getCssVar('--paper-bg', '#fff'),
      border: `1px solid ${getCssVar('--hairline-color', '#dce2e3')}`,
      borderRadius: 6,
      boxShadow: getCssVar('--floating-shadow', '0 12px 32px rgba(0,0,0,0.16)'),
      fontSize: 13,
    },
    tooltipContent: {
      padding: '18px 18px 12px',
      lineHeight: 1.55,
      textAlign: 'left',
    },
    tooltipFooter: {
      marginTop: 0,
      padding: '8px 12px 12px',
    },
    buttonPrimary: {
      minHeight: 30,
      padding: '0 11px',
      backgroundColor: getCssVar('--accent-color', '#287b76'),
      color: '#fff',
      borderRadius: 4,
      fontSize: 12,
    },
    buttonBack: {
      color: getCssVar('--muted-text', '#657176'),
      fontSize: 12,
    },
    buttonSkip: {
      color: getCssVar('--muted-text', '#657176'),
      fontSize: 12,
    },
    spotlight: {
      rx: 4,
    },
  };
  return (
    <>
      <Joyride
        key={activeTheme}
        steps={steps}
        run={run}
        continuous
        options={joyrideOptions}
        locale={{
          back: t('tour.back'),
          close: t('tour.close'),
          last: t('tour.last'),
          next: t('tour.next'),
          nextWithProgress: t('tour.nextWithProgress'),
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
