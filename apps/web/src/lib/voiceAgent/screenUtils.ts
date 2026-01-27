import { Screen } from '../../types/journey';

/**
 * Updates placeholder deeplinks (like "next-screen") in screens to reference actual screen IDs.
 * This ensures navigation works correctly by pointing to real screen IDs.
 * 
 * @param screens - Array of screens to update
 * @returns Updated screens with correct deeplinks
 */
export function updateScreenDeeplinks(screens: Screen[]): Screen[] {
  return screens.map((screen, index) => {
    const nextScreen = screens[index + 1];
    const prevScreen = screens[index - 1];

    return {
      ...screen,
      sections: screen.sections.map(section => ({
        ...section,
        elements: section.elements.map(element => {
          if (!element.events) return element;

          return {
            ...element,
            events: element.events.map((event: any) => {
              if (!event.action) return event;

              return {
                ...event,
                action: event.action.map((action: any) => {
                  if (action.type !== 'navigation') return action;

                  const deeplink = action.deeplink || '';
                  let targetId = deeplink;

                  try {
                    const url = new URL(deeplink);
                    const pathParts = url.pathname.split('/').filter(Boolean);
                    targetId = pathParts[pathParts.length - 1] || deeplink;
                  } catch {
                    // Not a URL, use as-is
                  }

                  if (targetId === 'next-screen' && nextScreen) {
                    return { ...action, deeplink: nextScreen.id };
                  }
                  if (targetId === 'prev-screen' && prevScreen) {
                    return { ...action, deeplink: prevScreen.id };
                  }

                  return action;
                }),
              };
            }),
          };
        }),
      })),
      events: screen.events?.map(event => {
        if (!event.action) return event;

        return {
          ...event,
          action: event.action.map((action: any) => {
            if (action.type !== 'navigation') return action;

            const deeplink = action.deeplink || '';
            let targetId = deeplink;

            try {
              const url = new URL(deeplink);
              const pathParts = url.pathname.split('/').filter(Boolean);
              targetId = pathParts[pathParts.length - 1] || deeplink;
            } catch {
              // Not a URL
            }

            if (targetId === 'next-screen' && nextScreen) {
              return { ...action, deeplink: nextScreen.id };
            }
            if (targetId === 'prev-screen' && prevScreen) {
              return { ...action, deeplink: prevScreen.id };
            }

            return action;
          }),
        };
      }),
    };
  });
}
