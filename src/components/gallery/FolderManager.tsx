'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './FolderManager.module.css';

export type ManagedFolder = {
  path: string;
  imageCount: number;
  videoCount: number;
};

interface FolderManagerProps {
  folders: ManagedFolder[];
  isBusy: boolean;
  onSelectFolder: (path: string) => void;
  onRenameFolder: (from: string, to: string) => Promise<void>;
  onDeleteFolder: (path: string) => Promise<void>;
}

export function FolderManager({
  folders,
  isBusy,
  onSelectFolder,
  onRenameFolder,
  onDeleteFolder,
}: FolderManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [renamingPath, setRenamingPath] = useState('');
  const [renameValue, setRenameValue] = useState('');

  return (
    <section className={styles.panel} aria-label="Folder management">
      <div className={styles.header}>
        <h2>Folders</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
        >
          {isOpen ? 'Hide' : 'Manage'}
        </Button>
      </div>

      {isOpen && (
        <ul className={styles.list}>
          {folders.map((folder) => {
            const assetCount = folder.imageCount + folder.videoCount;
            const isRenaming = renamingPath === folder.path;
            return (
              <li key={folder.path} className={styles.row}>
                <button type="button" className={styles.path} onClick={() => onSelectFolder(folder.path)}>
                  {folder.path === '/' ? 'Root' : folder.path}
                </button>
                <span>{`${folder.imageCount} images · ${folder.videoCount} videos`}</span>

                {isRenaming ? (
                  <form
                    className={styles.actions}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void onRenameFolder(folder.path, renameValue).then(() => {
                        setRenamingPath('');
                        setRenameValue('');
                      });
                    }}
                  >
                    <input
                      aria-label={`New path for ${folder.path}`}
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      placeholder="/new/path"
                    />
                    <Button size="sm" loading={isBusy}>Save</Button>
                    <Button variant="ghost" size="sm" onClick={() => setRenamingPath('')}>
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <div className={styles.actions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={folder.path === '/'}
                      onClick={() => {
                        setRenamingPath(folder.path);
                        setRenameValue(folder.path);
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={assetCount > 0 || folder.path === '/'}
                      onClick={() => void onDeleteFolder(folder.path)}
                    >
                      {assetCount > 0 ? 'Not Empty' : 'Delete'}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
