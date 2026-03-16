import React, { useState } from "react";
import { FaCloudUploadAlt, FaTimes, FaCode, FaCheck } from "react-icons/fa";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkAddDishes } from "../../https";
import { enqueueSnackbar } from "notistack";

interface BulkAddDishModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BulkAddDishModal: React.FC<BulkAddDishModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [jsonInput, setJsonInput] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  const sampleFormat = [
    {
      name: "Paneer Butter Masala",
      image: "https://images.unsplash.com/photo-1548943487-a2e4e43b4853?q=80&w=300",
      type: "main_course",
      category: "veg",
      variants: [
        { size: "Full", price: 350 },
        { size: "Half", price: 200 }
      ],
      description: "Creamy and delicious paneer dish."
    }
  ];

  const bulkMutation = useMutation({
    mutationFn: (data: any[]) => bulkAddDishes(data),
    onSuccess: (res) => {
      enqueueSnackbar(res.data?.message || "Dishes added successfully!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
      onClose();
      setJsonInput("");
    },
    onError: (error: any) => {
      console.error(error);
      const msg = error.response?.data?.message || "Failed to add dishes.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleBulkUpload = () => {
    try {
      setIsParsing(true);
      const dishes = JSON.parse(jsonInput);
      if (!Array.isArray(dishes)) {
        throw new Error("Input must be a JSON array of dishes.");
      }
      bulkMutation.mutate(dishes);
    } catch (err: any) {
      enqueueSnackbar(err.message || "Invalid JSON format.", { variant: "error" });
    } finally {
      setIsParsing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-2xl rounded-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dhaba-border/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-dhaba-accent/10 flex items-center justify-center">
              <FaCloudUploadAlt className="text-xl text-dhaba-accent" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-dhaba-text">Bulk Add Dishes</h2>
              <p className="text-xs text-dhaba-muted">Paste your JSON data below</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group">
            <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-dhaba-text flex items-center gap-2">
                <FaCode className="text-dhaba-accent" /> JSON Input
              </label>
              <button 
                onClick={() => setJsonInput(JSON.stringify(sampleFormat, null, 2))}
                className="text-xs text-dhaba-accent font-bold hover:underline"
              >
                Use Sample Format
              </button>
            </div>
            <textarea
              className="w-full h-64 glass-input rounded-2xl p-4 font-mono text-xs text-dhaba-text outline-none resize-none focus:ring-1 ring-dhaba-accent/50"
              placeholder='[ { "name": "Dish Name", ... } ]'
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
          </div>

          <div className="bg-dhaba-accent/5 rounded-2xl p-4 border border-dhaba-accent/10">
            <h4 className="text-xs font-bold text-dhaba-accent uppercase tracking-wider mb-2">Instructions</h4>
            <ul className="text-[11px] text-dhaba-muted space-y-1">
              <li>• Input must be a valid JSON array.</li>
              <li>• Required fields: <code>name</code>, <code>image</code>, <code>type</code>, <code>category</code>, <code>variants</code>.</li>
              <li>• <code>type</code> can be: starter, main_course, dessert, beverage, etc.</li>
              <li>• <code>category</code> can be: veg, non_veg, egg.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-dhaba-surface/30 border-t border-dhaba-border/20 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkUpload}
            disabled={!jsonInput.trim() || bulkMutation.isPending}
            className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkMutation.isPending ? (
              <div className="h-4 w-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
            ) : (
              <FaCheck />
            )}
            Add Dishes
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkAddDishModal;
