/**
 * Returns a callback for the server's "hello" event. The first build id is the one this page was
 * loaded with; a different one later means the server was upgraded, so the page reloads itself.
 */
export function watchBuild(reload: () => void = () => location.reload()): (buildId: string) => void {
  let loadedWith: string | undefined;
  return (buildId) => {
    if (loadedWith === undefined) loadedWith = buildId;
    else if (buildId !== loadedWith) reload();
  };
}
