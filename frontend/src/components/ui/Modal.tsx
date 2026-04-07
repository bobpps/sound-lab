import { useId, type ReactNode } from "react";

interface ModalProps {
  title: string;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({
  title,
  description,
  footer,
  onClose,
  children,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/55 p-4"
      role="dialog"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="text-sm text-gray-600" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>

          <button
            aria-label="Close dialog"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6">{children}</div>

        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </div>
  );
}
