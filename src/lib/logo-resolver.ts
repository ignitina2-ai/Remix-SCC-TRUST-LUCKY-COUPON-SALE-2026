import { useState, useEffect } from 'react';

/**
 * Custom React hook to dynamically resolve the active app logo 
 * depending on screen resolution (mobile vs desktop) and safe overrides.
 * 
 * Order of checks:
 * - Mobile:
 *   1. Settings config (`appData.logoMobile`)
 *   2. File folders (e.g. `/splash/mobile.png`, `/logo/mobile.png` etc.)
 *   3. Settings global logo (`appData.logo`)
 *   4. Fallback system svg (null)
 * 
 * - Desktop / Default:
 *   1. Settings config (`appData.logoDesktop`)
 *   2. File folders (e.g. `/splash/desktop.png`, `/logo/desktop.png` etc.)
 *   3. Settings global logo (`appData.logo`)
 *   4. Fallback system svg (null)
 */
export function useActiveResponsiveLogo(appData: any) {
  const [isMobile, setIsMobile] = useState(false);
  const [resolvedLogo, setResolvedLogo] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  // 1. Detect viewport state reactively
  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // 2. Perform sequential matching checks
  useEffect(() => {
    let isCurrent = true;

    // Define all folders/files candidates for both devices
    const mobileCandidates = [
      appData.logoMobile,
      '/splash/mobile.png',
      '/splash/mobile.jpg',
      '/splash/mobile.webp',
      '/splash/mobile.svg',
      '/logo/mobile.png',
      '/logo/mobile.jpg',
      '/logo/mobile.webp',
      '/logo/mobile.svg',
      appData.logo
    ].filter(Boolean);

    const desktopCandidates = [
      appData.logoDesktop,
      '/splash/desktop.png',
      '/splash/desktop.jpg',
      '/splash/desktop.webp',
      '/splash/desktop.svg',
      '/logo/desktop.png',
      '/logo/desktop.jpg',
      '/logo/desktop.webp',
      '/logo/desktop.svg',
      appData.logo
    ].filter(Boolean);

    const activeList = isMobile ? mobileCandidates : desktopCandidates;

    async function evaluateCandidates() {
      setIsValidating(true);
      for (const src of activeList) {
        if (!src) continue;

        // Immediately accept dataURLs or fully configured absolute/cloud URLs without redundant fetches
        if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('https://')) {
          if (isCurrent) {
            setResolvedLogo(src);
            setIsValidating(false);
            return;
          }
        }

        // Test local asset folders dynamically
        const fileExists = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
        });

        if (fileExists && isCurrent) {
          setResolvedLogo(src);
          setIsValidating(false);
          return;
        }
      }

      // Final fallback is null, rendering default SVG
      if (isCurrent) {
        setResolvedLogo(null);
        setIsValidating(false);
      }
    }

    evaluateCandidates();

    return () => {
      isCurrent = false;
    };
  }, [isMobile, appData.logo, appData.logoMobile, appData.logoDesktop]);

  return { resolvedLogo, isMobile, isValidating };
}
