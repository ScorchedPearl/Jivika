"""Jivika Insight Engine — trustworthy-AI layer on top of the Jivika diagnostic models.

Adds, on top of plain argmax classification:
  * uncertainty decomposition (aleatoric vs epistemic) via test-time augmentation
    and MC-dropout ensembles (BALD mutual information)
  * energy-based out-of-distribution detection (Liu et al., NeurIPS 2020)
  * multi-explainer saliency (Grad-CAM, Grad-CAM++, LayerCAM, occlusion) with
    an explainer-agreement score and a deletion-curve faithfulness test
  * exact Shapley attributions, ensemble disagreement and counterfactual
    recourse for the tabular heart-risk model
"""
