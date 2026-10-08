import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/ui/empty";
import { ArrowClockwiseIcon, CopyIcon, WarningIcon } from "@/ui/icons";
import { writeClipboardText } from "@/utils/clipboard";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * The root error boundary. A crash anywhere in the tree renders a screen with the
 * error, a reload, and copy buttons instead of a stuck or black window.
 */
export function CopyErrorAction({ error }: { error: Error | null }) {
  const copyDetails = async () => {
    const details = `Blimy crashed.\n\nMessage: ${error?.message ?? "Unknown error"}\n\n${
      error?.stack ?? "(no stack)"
    }`;
    await writeClipboardText(details).catch(() => {});
  };
  return (
    <Button variant="ghost" onClick={() => void copyDetails()}>
      <CopyIcon />
      Copy details
    </Button>
  );
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Blimy crashed during render:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Empty className="h-dvh w-dvw p-6" tone="warning" role="alert">
          <EmptyHeader>
            <EmptyMedia>
              <WarningIcon className="size-8" />
            </EmptyMedia>
            <EmptyTitle>Blimy hit a problem</EmptyTitle>
            <EmptyDescription className="max-w-xl wrap-break-word">
              {this.state.error?.message || "An unexpected error occurred."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row">
            <Button onClick={this.handleReload}>
              <ArrowClockwiseIcon />
              Reload
            </Button>
            <CopyErrorAction error={this.state.error} />
          </EmptyContent>
        </Empty>
      );
    }

    return this.props.children;
  }
}
