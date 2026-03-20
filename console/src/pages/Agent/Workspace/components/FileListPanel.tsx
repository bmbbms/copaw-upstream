import React, { useState, useMemo } from "react";
import { Button, Card, Input } from "@agentscope-ai/design";
import { Segmented } from "antd";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { MarkdownFile, DailyMemoryFile } from "../../../../api/types";
import { FileItem } from "./FileItem";
import { FolderNode } from "./FolderNode";
import { buildFileTree } from "./utils";
import { useTranslation } from "react-i18next";
import styles from "../index.module.less";

interface FileListPanelProps {
  files: MarkdownFile[];
  selectedFile: MarkdownFile | null;
  dailyMemories: DailyMemoryFile[];
  expandedMemory: boolean;
  workspacePath: string | null;
  enabledFiles: string[];
  viewMode: "core" | "all";
  onViewModeChange: (mode: "core" | "all") => void;
  onRefresh: () => void;
  onFileClick: (file: MarkdownFile) => void;
  onDailyMemoryClick: (daily: DailyMemoryFile) => void;
  onToggleEnabled: (filename: string) => void;
  onReorder: (newOrder: string[]) => void;
}

export const FileListPanel: React.FC<FileListPanelProps> = ({
  files,
  selectedFile,
  dailyMemories,
  expandedMemory,
  workspacePath,
  enabledFiles,
  viewMode,
  onViewModeChange,
  onRefresh,
  onFileClick,
  onDailyMemoryClick,
  onToggleEnabled,
  onReorder,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = enabledFiles.indexOf(active.id as string);
    const newIndex = enabledFiles.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(enabledFiles, oldIndex, newIndex);
    onReorder(newOrder);
  };

  // Filtered files for search mode
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.trim().toLowerCase();
    return files.filter((f) => f.filename.toLowerCase().includes(q));
  }, [searchQuery, files]);

  // Tree for non-search mode
  const fileTree = useMemo(
    () => buildFileTree(files, workspacePath),
    [files, workspacePath],
  );

  const hasSubfolders =
    fileTree.children.length > 0 || fileTree.files.length !== files.length;

  return (
    <div className={styles.fileListPanel}>
      <Card
        bodyStyle={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "auto",
        }}
        style={{ flex: 1, minHeight: 0 }}
      >
        <div className={styles.headerRow}>
          <h3 className={styles.sectionTitle}>{viewMode === "core" ? t("workspace.coreFiles") : t("workspace.allFiles", "All Files")}</h3>
          <Button size="small" onClick={() => onRefresh()} icon={<ReloadOutlined />}>
            {t("common.refresh")}
          </Button>
        </div>

        <Segmented
          options={[
            { label: t("workspace.coreFiles"), value: "core" },
            { label: t("workspace.allFiles", "All Files"), value: "all" },
          ]}
          value={viewMode}
          onChange={(val) => onViewModeChange(val as "core" | "all")}
          style={{ marginBottom: 12 }}
          block
        />

        {viewMode === "core" && (
          <p className={styles.infoText}>{t("workspace.coreFilesDesc")}</p>
        )}

        {/* Search box */}
        <Input
          prefix={<SearchOutlined style={{ color: "#bbb" }} />}
          placeholder={t("workspace.searchPlaceholder", "Search files…")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          size="small"
          className={styles.searchInput}
        />

        <div className={styles.divider} />

        <div className={styles.scrollContainer}>
          {files.length === 0 ? (
            <div className={styles.emptyState}>{t("workspace.noFiles")}</div>
          ) : filteredFiles !== null ? (
            /* ── Search results: flat list ── */
            filteredFiles.length === 0 ? (
              <div className={styles.emptyState}>
                {t("workspace.noSearchResults", "No files match your search")}
              </div>
            ) : (
              filteredFiles.map((file) => (
                <FileItem
                  key={file.filename}
                  file={file}
                  selectedFile={selectedFile}
                  expandedMemory={expandedMemory}
                  dailyMemories={dailyMemories}
                  enabled={enabledFiles.includes(file.filename)}
                  onFileClick={onFileClick}
                  onDailyMemoryClick={onDailyMemoryClick}
                  onToggleEnabled={onToggleEnabled}
                />
              ))
            )
          ) : hasSubfolders ? (
            /* ── Tree view when subfolders exist ── */
            <>
              {/* Root-level files */}
              {fileTree.files.map((file) => {
                const isEnabled = enabledFiles.includes(file.filename);
                return (
                  <FileItem
                    key={file.filename}
                    file={file}
                    selectedFile={selectedFile}
                    expandedMemory={expandedMemory}
                    dailyMemories={dailyMemories}
                    enabled={isEnabled}
                    onFileClick={onFileClick}
                    onDailyMemoryClick={onDailyMemoryClick}
                    onToggleEnabled={onToggleEnabled}
                  />
                );
              })}
              {/* Folder nodes */}
              {fileTree.children.map((node) => (
                <FolderNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedFile={selectedFile}
                  expandedMemory={expandedMemory}
                  dailyMemories={dailyMemories}
                  enabledFiles={enabledFiles}
                  onFileClick={onFileClick}
                  onDailyMemoryClick={onDailyMemoryClick}
                  onToggleEnabled={onToggleEnabled}
                />
              ))}
            </>
          ) : (
            /* ── Flat sortable list (original behaviour, no subfolders) ── */
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={enabledFiles}
                strategy={verticalListSortingStrategy}
              >
                {files.map((file) => {
                  const isEnabled = enabledFiles.includes(file.filename);
                  return (
                    <FileItem
                      key={file.filename}
                      file={file}
                      selectedFile={selectedFile}
                      expandedMemory={expandedMemory}
                      dailyMemories={dailyMemories}
                      enabled={isEnabled}
                      onFileClick={onFileClick}
                      onDailyMemoryClick={onDailyMemoryClick}
                      onToggleEnabled={onToggleEnabled}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </Card>
    </div>
  );
};
